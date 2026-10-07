export type ConsoleValueType = "string" | "number" | "boolean" | "enum";

export type ConsoleValue = string | number | boolean;

export interface ArgDefBase {
  name: string;
  required?: boolean;
  autocomplete?: () => readonly string[] | Promise<readonly string[]>;
}

export interface StringArgDef extends ArgDefBase {
  type: "string";
  rest?: boolean;
  enumValues?: never;
}

export interface NumberArgDef extends ArgDefBase {
  type: "number";
  rest?: never;
  enumValues?: never;
}

export interface BooleanArgDef extends ArgDefBase {
  type: "boolean";
  rest?: never;
  enumValues?: never;
}

export interface EnumArgDef extends ArgDefBase {
  type: "enum";
  enumValues: readonly string[];
  rest?: never;
}

export type ArgDef =
  | StringArgDef
  | NumberArgDef
  | BooleanArgDef
  | EnumArgDef;

export type ArgValue<TArg extends ArgDef> =
  TArg extends { type: "number"; } ? number :
    TArg extends { type: "boolean"; } ? boolean :
      TArg extends {
        enumValues: readonly (infer TValue extends string)[];
      } ? TValue : string;

type Simplify<T> = { [K in keyof T]: T[K] } & {};

type RequiredName<TArg extends ArgDef> =
  TArg extends { required: true; } ? TArg["name"] : never;

type OptionalName<TArg extends ArgDef> =
  TArg extends { required: true; } ? never : TArg["name"];

export type ArgValues<TArgs extends readonly ArgDef[]> = Simplify<
  {
    [TArg in TArgs[number] as RequiredName<TArg>]: ArgValue<TArg>;
  } & {
    [TArg in TArgs[number] as OptionalName<TArg>]?: ArgValue<TArg>;
  }
>;

export interface CommandContext {
  print(text: string): void;
  error(text: string): void;
  signal: AbortSignal;
}

export type Revert = () => void | Promise<void>;

export type CommandResult = void | Revert;

export interface CommandDef<
  TArgs extends readonly ArgDef[] = readonly ArgDef[]
> {
  description: string;
  args: TArgs;
  execute(
    args: ArgValues<TArgs>,
    ctx: CommandContext
  ): CommandResult | Promise<CommandResult>;
  closeOnExecute?: boolean;
}

export type VariableSetResult = void | false;

export interface StringVariableDef {
  type: "string";
  description: string;
  get(): string;
  set(
    value: string
  ): VariableSetResult | Promise<VariableSetResult>;
}

export interface NumberVariableDef {
  type: "number";
  description: string;
  get(): number;
  set(
    value: number
  ): VariableSetResult | Promise<VariableSetResult>;
}

export interface BooleanVariableDef {
  type: "boolean";
  description: string;
  get(): boolean;
  set(
    value: boolean
  ): VariableSetResult | Promise<VariableSetResult>;
}

export interface EnumVariableDef<
  TValue extends string = string
> {
  type: "enum";
  description: string;
  enumValues: readonly TValue[];
  get(): TValue;
  set(
    value: TValue
  ): VariableSetResult | Promise<VariableSetResult>;
}

export type VariableDef<
  TValue extends string = string
> =
  | StringVariableDef
  | NumberVariableDef
  | BooleanVariableDef
  | EnumVariableDef<TValue>;

export interface NamespaceMeta {
  description?: string;
}

export interface RegistrationHandle {
  unregister(): void;
}

export interface ConsoleNamespace {
  registerCommand<const TArgs extends readonly ArgDef[]>(
    name: string,
    def: CommandDef<TArgs>
  ): RegistrationHandle;
  registerVariable<const TValue extends string>(
    name: string,
    def: VariableDef<TValue>
  ): RegistrationHandle;
  unregister(): void;
}

export interface RegisteredCommand {
  readonly kind: "command";
  readonly name: string;
  readonly address: string;
  readonly description: string;
  readonly namespace: RegisteredNamespace;
  readonly def: CommandDef;
  readonly signal: AbortSignal;
}

export interface RegisteredVariable {
  readonly kind: "variable";
  readonly name: string;
  readonly address: string;
  readonly description: string;
  readonly namespace: RegisteredNamespace;
  readonly def: VariableDef;
}

export interface RegisteredNamespace {
  readonly kind: "namespace";
  readonly name: string;
  readonly address: string;
  readonly description: string;
  readonly implicit: boolean;
  command(
    name: string
  ): RegisteredCommand | undefined;
  variable(
    name: string
  ): RegisteredVariable | undefined;
  commands(): IterableIterator<RegisteredCommand>;
  variables(): IterableIterator<RegisteredVariable>;
  [Symbol.iterator](): IterableIterator<RegisteredMember>;
}

export type RegisteredMember =
  | RegisteredCommand
  | RegisteredVariable;

export type RegisteredEntry =
  | RegisteredCommand
  | RegisteredVariable
  | RegisteredNamespace;

export interface ConsoleRegistry {
  readonly root: RegisteredNamespace;
  readonly scope: RegisteredNamespace;
  namespace(
    address: string
  ): RegisteredNamespace | undefined;
  namespaces(): IterableIterator<RegisteredNamespace>;
  children(
    namespace: RegisteredNamespace
  ): IterableIterator<RegisteredNamespace>;
  [Symbol.iterator](): IterableIterator<RegisteredNamespace>;
  resolveCommand(
    address: string
  ): RegisteredCommand | undefined;
  resolveVariable(
    address: string
  ): RegisteredVariable | undefined;
}
