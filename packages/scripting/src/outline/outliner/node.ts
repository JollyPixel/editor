// Import Third-party Dependencies
import type {
  ClassDeclaration,
  Expression,
  MethodDeclaration,
  Node,
  ObjectLiteralExpression,
  PropertyDeclaration,
  TypeNode
} from "ts-morph";

// Import Internal Dependencies
import type {
  ScriptBehavior,
  ScriptMember,
  ScriptOutline,
  ScriptParameter,
  ScriptProperty,
  ScriptPropertyValue
} from "../ScriptOutline.schema.ts";

type TsMorph = typeof import("ts-morph");

interface Outliner {
  readonly morph: TsMorph;
  readonly project: InstanceType<TsMorph["Project"]>;
}

// CONSTANTS
const kSourceFileName = "script.ts";
const kPropertyDecorator = "SceneProperty";
const kBehaviorBase = /(?:^|\.)Behavior$/;
const kSignalClass = /(?:^|\.)SignalEvent$/;
const kLifecycleMethods = new Set([
  "bind",
  "awake",
  "start",
  "update",
  "fixedUpdate",
  "destroy",
  "onDestroy"
]);

let outliner: Promise<Outliner> | null = null;

export async function readScriptOutline(
  text: string
): Promise<ScriptOutline | null> {
  outliner ??= import("ts-morph").then((morph) => {
    return {
      morph,
      project: new morph.Project({
        useInMemoryFileSystem: true,
        skipAddingFilesFromTsConfig: true,
        skipLoadingLibFiles: true
      })
    };
  });
  const { morph, project } = await outliner;
  const sourceFile = project.createSourceFile(kSourceFileName, text, {
    overwrite: true
  });

  const behaviors: ScriptBehavior[] = [];
  for (const declaration of sourceFile.getClasses()) {
    const behavior = readBehavior(morph, declaration);
    if (behavior !== null) {
      behaviors.push(behavior);
    }
  }

  return { behaviors };
}

function readBehavior(
  morph: TsMorph,
  declaration: ClassDeclaration
): ScriptBehavior | null {
  const name = declaration.getName();
  if (name === undefined) {
    return null;
  }

  const properties: ScriptProperty[] = [];
  const signals: ScriptMember[] = [];
  for (const property of declaration.getProperties()) {
    const read = readProperty(morph, property);
    if (read !== null) {
      properties.push(read);
    }
    const signal = readSignal(morph, property);
    if (signal !== null) {
      signals.push(signal);
    }
  }
  const base = declaration.getExtends()?.getExpression().getText() ?? "";
  if (properties.length === 0 && !kBehaviorBase.test(base)) {
    return null;
  }

  return {
    name,
    properties,
    signals,
    methods: declaration.getMethods().flatMap(
      (method) => readMethod(morph, method) ?? []
    )
  };
}

function readSignal(
  morph: TsMorph,
  property: PropertyDeclaration
): ScriptMember | null {
  if (property.isStatic() || property.getName().startsWith("#")) {
    return null;
  }

  const is = morph.Node;
  const annotation = property.getTypeNode();
  const initializer = property.getInitializer();
  const annotated = is.isTypeReference(annotation) &&
    kSignalClass.test(annotation.getTypeName().getText());
  const constructed = is.isNewExpression(initializer) &&
    kSignalClass.test(initializer.getExpression().getText());
  if (!annotated && !constructed) {
    return null;
  }

  const [tuple] = [
    ...annotated ? annotation.getTypeArguments() : [],
    ...constructed ? initializer.getTypeArguments() : []
  ];

  return {
    key: property.getName(),
    params: readTupleParameters(morph, tuple)
  };
}

function readTupleParameters(
  morph: TsMorph,
  tuple: TypeNode | undefined
): ScriptParameter[] {
  const is = morph.Node;
  if (!is.isTupleTypeNode(tuple)) {
    return [];
  }

  return tuple.getElements().map((element, index) => {
    if (is.isNamedTupleMember(element)) {
      return {
        name: element.getName(),
        type: element.getTypeNode().getText()
      };
    }

    return {
      name: `arg${index}`,
      type: element.getText()
    };
  });
}

function readMethod(
  morph: TsMorph,
  method: MethodDeclaration
): ScriptMember | null {
  const key = method.getName();
  if (
    method.isStatic() ||
    key.startsWith("#") ||
    method.getScope() !== morph.Scope.Public ||
    kLifecycleMethods.has(key)
  ) {
    return null;
  }

  return {
    key,
    params: method.getParameters().map((parameter) => {
      return {
        name: parameter.getName(),
        type: parameter.getTypeNode()?.getText() ?? ""
      };
    })
  };
}

function readProperty(
  morph: TsMorph,
  property: PropertyDeclaration
): ScriptProperty | null {
  const decorator = property.getDecorator(kPropertyDecorator);
  const [options] = decorator?.getArguments() ?? [];
  if (options === undefined || !morph.Node.isObjectLiteralExpression(options)) {
    return null;
  }
  const literal: ObjectLiteralExpression = options;

  function option(
    key: string
  ): string | null {
    const assignment = literal.getProperty(key);
    if (!morph.Node.isPropertyAssignment(assignment)) {
      return null;
    }
    const value = assignment.getInitializer();

    return morph.Node.isStringLiteral(value) ||
      morph.Node.isNoSubstitutionTemplateLiteral(value) ?
      value.getLiteralValue() :
      null;
  }

  const type = option("type");
  if (type === null) {
    return null;
  }
  const key = property.getName();
  const initializer = property.getInitializer();

  return {
    key,
    type,
    label: option("label") ?? key,
    description: option("description") ?? "",
    default: initializer === undefined ? null : readValue(morph, initializer)
  };
}

function readValue(
  morph: TsMorph,
  expression: Expression
): ScriptPropertyValue | null {
  const is = morph.Node;
  if (is.isArrayLiteralExpression(expression)) {
    const items = expression.getElements().map((element) => readScalar(morph, element));

    return items.every((item) => item !== null) ? items : null;
  }
  if (is.isNewExpression(expression)) {
    const items = expression.getArguments().map((argument) => readScalar(morph, argument));
    if (!items.every((item) => item !== null)) {
      return null;
    }
    const [first] = items;

    return items.length === 1 && typeof first === "string" ? first : items;
  }
  if (is.isParenthesizedExpression(expression)) {
    return readValue(morph, expression.getExpression());
  }
  if (is.isAsExpression(expression)) {
    return readValue(morph, expression.getExpression());
  }

  return readScalar(morph, expression);
}

function readScalar(
  morph: TsMorph,
  node: Node
): string | number | boolean | null {
  const is = morph.Node;
  if (is.isNumericLiteral(node)) {
    return node.getLiteralValue();
  }
  if (is.isStringLiteral(node) || is.isNoSubstitutionTemplateLiteral(node)) {
    return node.getLiteralValue();
  }
  if (is.isTrueLiteral(node) || is.isFalseLiteral(node)) {
    return node.getLiteralValue();
  }
  if (
    is.isPrefixUnaryExpression(node) &&
    node.getOperatorToken() === morph.SyntaxKind.MinusToken
  ) {
    const operand = node.getOperand();

    return is.isNumericLiteral(operand) ? -operand.getLiteralValue() : null;
  }

  return null;
}
