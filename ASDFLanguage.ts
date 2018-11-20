/*
  Lexer

  The lexer is responsible for turning the input string into a list of tokens.
*/
const lex = str => str.split(/\s+/).map(s => s.trim()).filter(s => s.length);

/*
  CustomFunctions

  Object containing callbacks for custom functionality.
*/
let CustomFunctions = {
  getItem: async ({ id }) => { throw new ASDFInternalError('CustomFunctions.getItem not defined') }
};

/*
  Operators

  All operators symbols and tables are defined here.
*/
const Op = Symbol('op');
const Num = Symbol('num');
const NumPercent = Symbol('numpercent');
const Str = Symbol('str');

const ConditionalOp = Symbol('conditionalop');
const IfBodyOp = Symbol('ifbodyop');

const Utils = {
  // Avoids floating point rounding numbers and guarantees exact definitions for 2 fraction digits
  toFixedPrecision2: (x) => Number(x.toFixed(2)),
  // Calculates a total amount properly
  calcTotal: (x) => Utils.toFixedPrecision2(x),
  // Calculates a number based on the AST node (either Num or NumPercent)
  calcNumber: (ast, value) => ast.type == NumPercent ? (value * Number(ast.val) / 100) : Number(ast.val),
  // Convert from JS to Num type
  JStoNum: (x) => ({ val: Number(x), type: Num }),
  // Convert from JS to Str type
  JStoStr: (x) => ({ val: String(x), type: Str })
};

const ops = {
  sum:  { num: 2, eval: args => args.reduce((a, b) => Number(a.val) + Number(b.val), 0) },
  sub:  { num: 2, eval: args => args.reduce((a, b) => Number(a.val) - Number(b.val)) },
  div:  { num: 2, eval: args => args.reduce((a, b) => Number(a.val) / Number(b.val)) },
  mul:  { num: 2, eval: args => args.reduce((a, b) => Number(a.val) * Number(b.val), 1) },

  // Conditional instructions
  if: {
    conditional: true,
    eval: args => {
      return Number(args[0].val) ? Number(args[1].val) : 0;
    },
    parse: async (p, ast, data) => {
      // Internal AST validity check (debugging)
      if (!(p.length >= 2 && p[0].type == ConditionalOp && p[1].type == IfBodyOp)) {
        throw new ASDFInternalError(`if does not have ConditionalOp and IfBodyOp`);
      }

      // Evaluate ConditionalOp first
      const condition = await evaluate(p[0], data);
      if (condition && condition[0].val) {
        // If condition was true, evaluate IfBodyOp
        const e = await evaluate(p[1], data);
        return e;
      }
      else {
        // If condition was false, return false
        return false;
      }
    }
  },

  // Code block instructions
  '{': { end: '}' },
  '}': {},

  // Comparison instructions
  '>': { num: 2, eval: (args) => args[0].val > args[1].val },
  '<': { num: 2, eval: (args) => args[0].val < args[1].val },
  '>=': { num: 2, eval: (args) => args[0].val >= args[1].val },
  '<=': { num: 2, eval: (args) => args[0].val <= args[1].val },
  '==': { num: 2, eval: (args) => args[0].val == args[1].val },
  '!=': { num: 2, eval: (args) => args[0].val != args[1].val },

  // cart_count_items() -> Num
  cart_count_items: { num: 0, eval: (args, data) => {
    return data.items.length;
  } },
  // cart_has_item(pricingId: Str) -> Num
  cart_has_item: { num: 1, eval: (args, data) => {
    const pricingId = args[0].val;
    return data.items && (data.items.filter((p) => p.price.id == pricingId).length > 0) ? 1 : 0;
  } },
  // cart_get_item_amount(pricingId: Str) -> Num
  cart_get_item_amount: { num: 1, eval: (args, data) => {
    const pricingId = args[0].val;
    const item = data.items ? data.items.filter((p) => p.price.id == pricingId) : [];
    if (item.length < 1) {
      throw new ASDFProgramError(`Item '${pricingId}' does not exist`);
    }
    return Number(item[0].price.amount);
  } },
  // cart_set_item_amount(pricingId: Str, amount: Num;NumPercent)
  cart_set_item_amount: { num: 2, eval: (args, data) => {
    const pricingId = args[0].val;
    const amountAst = args[1];
    let found = false, total = 0;
    for (let p of data.items) {
      if (p.price.id == args[0].val) {
        p.price.amount = Utils.calcNumber(amountAst, p.price.amount)
        found = true;
      }
      if (!Number.isFinite(p.price.amount)) {
        throw new ASDFProgramError(`Product ${JSON.stringify(p)} does not have a valid amount`);
      }
      total += p.price.amount;
    }
    data.total = Utils.calcTotal(total);
    return found ? 1 : 0;
  } },
  // cart_set_all_items_amount(amount: Num;NumPercent)
  cart_set_all_items_amount: { num: 1, eval: (args, data) => {
    const amountAst = args[0];
    let found = false, total = 0;
    for (let p of data.items) {
      p.price.amount = Utils.calcNumber(amountAst, p.price.amount)
      total += p.price.amount;
    }
    data.total = Utils.calcTotal(total);
    return 1;
  } },
  // cart_add_item(pricingId: Str) async
  cart_add_item: { num: 1, eval: async (args, data) => {
    data.items.push(await CustomFunctions.getItem(
      { id: String(args[0].val) }
    ));
    return 1;
  } },
  // cart_set_total(amount: Num;NumPercent)
  cart_set_total: { num: 1, eval: (args, data) => {
    const amountAst = args[0];
    data.total = Utils.calcTotal(Utils.calcNumber(amountAst, data.total));
    return 1;
  } },
  // cart_get_total() -> Num
  cart_get_total: { num: 0, eval: (args, data) => {
    return data.total;
  } },
  // cart_add_discount(amount: Num)
  cart_add_discount: { num: 1, eval: (args, data) => {
    const amount = args[0].val;
    data.discount += Utils.calcTotal(amount);
    return 1;
  } }

  /* TODO: Possible future functions */
  // cart_has_promo(promoName:Str)
  // cart_has_coupon(couponId:Str)
  // user_has_purchase(productId:Str)
};

/*
  Parser

  The parser is responsible for turning the list of tokens into an Abstract Syntax Tree.

  The parser uses the following grammar to parse the input token array:

  ```
  num := 0-9+
  numpercent := 0-9+%
  str := .*
  op := sum | sub | div | mul | if | { | } | ...
  expr := num | numpercent | 'str' | op expr+
  ```
*/

const parse = tokens => {
  let c = 0;
  const peek = () => tokens[c];
  const consume = () => tokens[c++];

  const parseNum = () => ({ val: Number(consume()), type: Num });
  const parseNumPercent = () => ({ val: Number(consume().slice(0, -1)), type: NumPercent });
  const parseStr = () => ({ val: String(consume()).slice(1, -1), type: Str });

  const parseOp = () => {
    const node = { val: consume(), type: Op, expr: [] };

    // Check for valid operator
    if (!ops[node.val]) {
      throw new ASDFSyntaxError(`${node.val} is not a valid operator`);
    }

    const numOperands = ops[node.val].num;
    const endOperator = ops[node.val].end;
    const conditional = ops[node.val].conditional;

    // Consume tokens depending on operator configuration
    if (numOperands) {
      // Consume required number of operands
      for (let i = 0; i < numOperands; i++) {
        // Check for operand
        if (!peek()) {
          throw new ASDFSyntaxError(`${node.val} requires ${numOperands} operands`);
        }
        // Parse operand
        node.expr.push(parseExpr());
      }
    }
    else if (endOperator) {
      // Consume everything until end operator
      while (peek() != endOperator) {
        if (!peek()) {
          throw new ASDFSyntaxError(`${node.val} requires closing operator ${endOperator}`);
        }
        // Parse operand
        node.expr.push(parseExpr());
      }
      // Consume end operator
      parseExpr();
    }
    else if (conditional) {
      // Conditional operator: 2 operators (condition, clause)
      node.expr.push({ type: ConditionalOp, expr: [ parseExpr() ] });
      node.expr.push({ type: IfBodyOp, expr: [ parseExpr() ] });
    }
    else {
      // Operator without further use
    }
    return node;
  };

  // Expression parser
  const parseExpr = () => {
    if (/[-+]?[0-9]*\.?[0-9]+$/.test(peek())) {
      return parseNum();
    }
    else if (/[-+]?[0-9]*\.?[0-9]+%$/.test(peek())) {
      return parseNumPercent();
    }
    else if (/'.*'/.test(peek())) {
      return parseStr();
    }
    else {
      return parseOp();
    }
  };

  // Always evaluate input as code block so multiple expressions at top level are supported
  const node = { val: '{', type: Op, expr: [] };
  while (peek()) {
    node.expr.push(parseExpr());
  }
  return node;
};

/*
  Evaluator

  Each AST node is visited with pre-order traversal and each operand is evaluated.
  The Evaluator is inherently asynchronous, so will wait for each (asynchronous) operand to finish before traversing.
*/
const evaluate = async (ast, data) => {
  // console.log("* " + JSON.stringify(ast));

  // Evaluate immediate values immediately
  if (ast.type === Num) {
    return ast;
  }
  else if (ast.type == NumPercent) {
    return ast;
  }
  else if (ast.type == Str) {
    return ast;
  }

  // Resolve expressions (children)
  const p = await Promise.all(ast.expr);

  // Check for custom AST parse function
  if (ast.val && ops[ast.val].parse) {
    return await ops[ast.val].parse(p, ast, data);
  }
  else {
    // Use standard recursive AST evaluation
    const q = await Promise.all(p.map((p) => evaluate(p, data)));
    // If operation is defined
    if (ast.val && ops[ast.val].eval) {
      // Parse expression, resolve Promise
      const e = await ops[ast.val].eval(q, data);
      // Convert to appropriate return type if specified, otherwise convert to Num by default
      if (ast.returnType == Str) {
        return Utils.JStoStr(e);
      }
      else {
        return Utils.JStoNum(e);
      }
    }
    else {
      // Return unmodified
      return q;
    }
  }
};

/*
  Errors

  All throwable Errors are defined here.
*/
export class ASDFSyntaxError extends Error {
  constructor(message) {
    super(message);
    this.name = "ASDFSyntaxError";
    this.message = (message || "");
  }
}

export class ASDFInternalError extends Error {
  constructor(message) {
    super(message);
    this.name = "ASDFInternalError";
    this.message = (message || "");
  }
}

export class ASDFProgramError extends Error {
  constructor(message) {
    super(message);
    this.name = "ASDFProgramError";
    this.message = (message || "");
  }
}

/*
  ASDFInterpreter

  Initiates the actual program parsing, lexing and evaluation.
*/
export class ASDFInterpreter {
  static async run(input, program, functions) {
    // Validity checks
    if (!program) {
      throw new ASDFProgramError(`No valid program`);
    }
    if (!input) {
      throw new ASDFProgramError(`No valid input`);
    }

    // Update CustomFunctions
    CustomFunctions = functions;

    // Construct AST
    const ast = parse(lex(program));

    // Copy input object to new data object that will be changed by evaluate
    let data = JSON.parse(JSON.stringify(input));

    // Evaluate AST
    await evaluate(ast, data);
    return data;
  }
}
