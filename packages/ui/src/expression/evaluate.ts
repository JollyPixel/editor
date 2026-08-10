// CONSTANTS
const kPlainNumber = /^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:[eE][+-]?\d+)?$/;
const kNumberAt = /^(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:[eE][+-]?\d+)?/;
const kPrecedence: Record<string, number> = {
  "+": 1,
  "-": 1,
  "*": 2,
  "/": 2,
  "u+": 3,
  "u-": 3
};

export type EvalResult =
  | { ok: true; value: number; }
  | { ok: false; error: string; };

type Token =
  | { type: "number"; value: number; }
  | { type: "operator"; value: string; }
  | { type: "paren"; value: "(" | ")"; };

class ExpressionError extends Error {}

/**
 * Evaluates a numeric field expression: `1920/2` commits `960`.
 *
 * Grammar is `+ - * /`, parentheses, unary sign, and decimal or scientific literals. A comma also
 * reads as a decimal separator, since no rule uses one and `1,5` is what a French locale types.
 *
 * Returns a result rather than throwing, since a malformed expression is expected user input.
 * Nothing eval shaped is denylisted; `alert(1)` fails because `a` is not a token here.
 */
export function evaluate(
  input: string
): EvalResult {
  const text = input.trim();
  if (text === "") {
    return {
      ok: false,
      error: "Expression is empty"
    };
  }

  // Most field entries are a bare number and never reach the parser.
  if (kPlainNumber.test(text)) {
    return finalize(
      Number(text.replace(",", "."))
    );
  }

  try {
    return finalize(
      reduce(toPostfix(tokenize(text)))
    );
  }
  catch (error) {
    if (error instanceof ExpressionError) {
      return {
        ok: false,
        error: error.message
      };
    }

    throw error;
  }
}

function finalize(
  value: number
): EvalResult {
  if (!Number.isFinite(value)) {
    return {
      ok: false,
      error: "Result is not a finite number"
    };
  }

  return {
    ok: true,
    value
  };
}

function tokenize(
  text: string
): Token[] {
  const tokens: Token[] = [];
  let index = 0;

  while (index < text.length) {
    const char = text[index];

    if (char === " " || char === "\t") {
      index += 1;
    }
    else if (char === "(" || char === ")") {
      tokens.push({
        type: "paren",
        value: char
      });
      index += 1;
    }
    else if (char in kPrecedence) {
      tokens.push({
        type: "operator",
        value: char
      });
      index += 1;
    }
    else {
      index = readNumber(
        text,
        index,
        tokens
      );
    }
  }

  return tokens;
}

function readNumber(
  text: string,
  index: number,
  tokens: Token[]
): number {
  const match = kNumberAt.exec(
    text.slice(index)
  );
  if (match === null) {
    throw new ExpressionError(
      `Unexpected character "${text[index]}"`
    );
  }

  tokens.push({
    type: "number",
    value: Number(
      match[0].replace(",", ".")
    )
  });

  return index + match[0].length;
}

function toPostfix(
  tokens: Token[]
): Token[] {
  const output: Token[] = [];
  const operators: Token[] = [];
  let expectValue = true;

  for (const token of tokens) {
    if (token.type === "number") {
      output.push(token);
      expectValue = false;
    }
    else if (token.type === "paren") {
      expectValue = handleParen(
        token,
        output,
        operators
      );
    }
    else {
      pushOperator(
        expectValue ? asUnary(token.value) : token.value,
        output,
        operators
      );
      expectValue = true;
    }
  }

  drainTo(output, operators, null);
  if (expectValue) {
    throw new ExpressionError("Expression ends with an operator");
  }

  return output;
}

function handleParen(
  token: Token,
  output: Token[],
  operators: Token[]
): boolean {
  if (token.value === "(") {
    operators.push(token);

    return true;
  }

  drainTo(output, operators, "(");
  if (operators.length === 0) {
    throw new ExpressionError("Unbalanced parenthesis");
  }
  operators.pop();

  return false;
}

function pushOperator(
  operator: string,
  output: Token[],
  operators: Token[]
): void {
  const precedence = kPrecedence[operator];
  const rightAssociative = operator.startsWith("u");

  while (operators.length > 0) {
    const top = operators[operators.length - 1];
    if (top.type !== "operator") {
      break;
    }

    const topPrecedence = kPrecedence[top.value];
    if (
      topPrecedence < precedence ||
      (rightAssociative && topPrecedence === precedence)
    ) {
      break;
    }
    output.push(operators.pop()!);
  }

  operators.push({
    type: "operator",
    value: operator
  });
}

function asUnary(
  operator: string
): string {
  if (operator !== "+" && operator !== "-") {
    throw new ExpressionError(`Operator "${operator}" has no left operand`);
  }

  return `u${operator}`;
}

function drainTo(
  output: Token[],
  operators: Token[],
  stopAt: "(" | null
): void {
  while (operators.length > 0) {
    const top = operators[operators.length - 1];
    if (top.type === "paren") {
      if (stopAt === "(") {
        return;
      }

      throw new ExpressionError("Unbalanced parenthesis");
    }

    output.push(operators.pop()!);
  }

  if (stopAt === "(") {
    throw new ExpressionError("Unbalanced parenthesis");
  }
}

function reduce(
  postfix: Token[]
): number {
  const stack: number[] = [];

  for (const token of postfix) {
    if (token.type === "number") {
      stack.push(token.value);
    }
    else if (token.value === "u-" || token.value === "u+") {
      stack.push(token.value === "u-" ? -pop(stack) : pop(stack));
    }
    else {
      const right = pop(stack);
      stack.push(apply(token.value, pop(stack), right));
    }
  }

  if (stack.length !== 1) {
    throw new ExpressionError("Malformed expression");
  }

  return stack[0];
}

function apply(
  operator: string,
  left: number,
  right: number
): number {
  if (operator === "/" && right === 0) {
    throw new ExpressionError("Division by zero");
  }

  switch (operator) {
    case "+": return left + right;
    case "-": return left - right;
    case "*": return left * right;
    default: return left / right;
  }
}

function pop(
  stack: number[]
): number {
  const value = stack.pop();
  if (value === undefined) {
    throw new ExpressionError("Malformed expression");
  }

  return value;
}
