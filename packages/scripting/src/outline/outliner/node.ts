// Import Third-party Dependencies
import type {
  ClassDeclaration,
  Expression,
  Node,
  ObjectLiteralExpression,
  PropertyDeclaration
} from "ts-morph";

// Import Internal Dependencies
import type {
  ScriptBehavior,
  ScriptOutline,
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
  for (const property of declaration.getProperties()) {
    const read = readProperty(morph, property);
    if (read !== null) {
      properties.push(read);
    }
  }
  const base = declaration.getExtends()?.getExpression().getText() ?? "";
  if (properties.length === 0 && !kBehaviorBase.test(base)) {
    return null;
  }

  return {
    name,
    properties
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
