/**
 * ASDFLanguage
 *
 * TODOs
 *
 */

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
  getItem: async ({ id }) => { throw new ASDFInternalError("CustomFunctions.getItem not defined"); }
};

/*
  Operator and type definitions
*/
const ASDF = {
  array: Symbol("array"),
  var: Symbol("var"),

  // Immediate operators (cannot contain any children ASTs)
  number: Symbol("number"),
  percent: Symbol("percent"),
  string: Symbol("string"),
  cartitems: Symbol("cartitems"),

  // Internal parse/eval only (non-specifiable) operators
  op: Symbol("op"),
  conditionalop: Symbol("conditionalop"),
  ifbodyop: Symbol("ifbodyop"),
};

const Utils = {
  // Avoids floating point rounding numbers and guarantees exact definitions for 2 fraction digits
  toFixedPrecision2: (x) => Number(x.toFixed(2)),
  // Calculates a total amount properly
  calcTotal: (x) => Utils.toFixedPrecision2(x),

  // Convert from JS to specific type
  JStoType: (type, x) => {
    if (type == ASDF.number) {
      return { val: Number(x), type };
    }
    else if (type == ASDF.percent) {
      return { val: Number(x), type };
    }
    else if (type == ASDF.string) {
      return { val: String(x), type };
    }
    else if (type == ASDF.array) {
      return { val: x, type };
    }
    else if (type == ASDF.cartitems) {
      return { val: x, type };
    }
    else {
      throw new ASDFInternalError(`Type ${type ? type.toString() : type} could not be found`);
    }
  },
  // Convert from specific type to JS
  TypetoJS: (type, ast, gracefulError?) => {
    if (type != ast.type) {
      if (!gracefulError) {
        throw new ASDFProgramError(`Expected type ${type.toString()} but got ${ast.type.toString()}`);
      }
      else {
        // Graceful error, handled by caller itself
        return undefined;
      }
    }
    if (ast.type == ASDF.number) {
      return Number(ast.val);
    }
    else if (ast.type == ASDF.percent) {
      return Number(ast.val);
    }
    else if (ast.type == ASDF.string) {
      return String(ast.val);
    }
    else if (ast.type == ASDF.array) {
      return ast.val.map((x) => x.val);
    }
    else if (ast.type == ASDF.cartitems) {
      return ast.val; // Mimics data.items, val doesn't contain any ASTs
    }
    else {
      throw new ASDFInternalError(`Unknown type ${type.toString()}`);
    }
  }
};

const ops = {
  // Arithmetic instructions
  add:  { num: 2, eval: args => Utils.JStoType(ASDF.number, Utils.TypetoJS(ASDF.number, args[0]) + Utils.TypetoJS(ASDF.number, args[1])) },
  sub:  { num: 2, eval: args => Utils.JStoType(ASDF.number, Utils.TypetoJS(ASDF.number, args[0]) - Utils.TypetoJS(ASDF.number, args[1])) },
  div:  { num: 2, eval: args => Utils.JStoType(ASDF.number, Utils.TypetoJS(ASDF.number, args[0]) / Utils.TypetoJS(ASDF.number, args[1])) },
  mul:  { num: 2, eval: args => Utils.JStoType(ASDF.number, Utils.TypetoJS(ASDF.number, args[0]) * Utils.TypetoJS(ASDF.number, args[1])) },

  // Comparison instructions
  // NOTE: These instructions do no type checking and make use of ast.val directly,
  // so that multiple types are implicitly supported without further type checking!
  ">": { num: 2, eval: (args) => Utils.JStoType(ASDF.number, args[0].val > args[1].val) },
  "<": { num: 2, eval: (args) => Utils.JStoType(ASDF.number, args[0].val < args[1].val) },
  ">=": { num: 2, eval: (args) => Utils.JStoType(ASDF.number, args[0].val >= args[1].val) },
  "<=": { num: 2, eval: (args) => Utils.JStoType(ASDF.number, args[0].val <= args[1].val) },
  "==": { num: 2, eval: (args) => Utils.JStoType(ASDF.number, args[0].val == args[1].val) },
  "!=": { num: 2, eval: (args) => Utils.JStoType(ASDF.number, args[0].val != args[1].val) },

  // Conditional instructions
  if: {
    conditional: true,
    eval: (args) => {
      // If currently only support a number expression as its conditional (this works as long as booleans are encoded as 1 and 0)
      const conditional = Utils.TypetoJS(ASDF.number, args[0]);
      return Utils.JStoType(ASDF.number, conditional ? args[1].val : 0);
    },
    // Custom walk function, is needed so that conditionals expressions are never automatically evaluated
    walk: async (p, ast, data) => {
      // Internal AST validity check (debugging)
      if (!(p.length >= 2 && p[0].type == ASDF.conditionalop && p[1].type == ASDF.ifbodyop)) {
        throw new ASDFInternalError(`if does not have conditionalop and ifbodyop`);
      }

      // Evaluate conditionalop first
      const condition = await evaluate(p[0], data);
      if (condition && condition[0].val) {
        // If condition was true, evaluate ifbodyop
        const e = await evaluate(p[1], data);
        return e;
      }
      else {
        // If condition was false, return false
        return false;
      }
    }
  },

  // Variable assignment instructions
  set: { num: 2,
    // Custom walk function to evaluate and set variables in memory
    walk: async (p, ast, data) => {
      console.log("p",p);
      console.log("ast",ast);
      // Internal AST validity check (debugging)
      if (!(p.length >= 2 && p[0].type == ASDF.var)) {
        throw new ASDFProgramError(`set is trying to set a wrong type ${p[0].type.toString()}`);
      }
      const varName = p[0].val; // ASDF.var
      const varValueExpr = p[1];

      // Evaluate value expression
      const varValue = await evaluate(varValueExpr, data);

      // Assign to var in vars memory
      data.vars[varName] = varValue;
      return varValue;
  } },

  // Array instructions
  "[": { end: "]", eval: (args) => Utils.JStoType(ASDF.array, args) },
  "]": {},

  // Comment block instructions
  "/*": { end: "*/", comment: true },
  "*/": {},

  // Code block instructions
  "{": { end: "}" },
  "}": {},

  // Array instructions
  // slice(input: array|cartitems, begin: number, end: number) -> array|cartitems
  slice: { num: 3, eval: (args) => {
    const inputAst = args[0];
    const begin = Number(Utils.TypetoJS(ASDF.number, args[1]));
    const end = Number(Utils.TypetoJS(ASDF.number, args[2]));
    if (inputAst.type == ASDF.array) {
      return Utils.JStoType(ASDF.array, Utils.TypetoJS(ASDF.array, inputAst).slice(begin, end));
    }
    else if (inputAst.type == ASDF.cartitems) {
      return Utils.JStoType(ASDF.cartitems, Utils.TypetoJS(ASDF.cartitems, inputAst).slice(begin, end));
    }
    else {
      throw new ASDFProgramError(`slice expects array or cartitems type`);
    }
  } },
  // count(input: array|cartitems) -> number
  count: { num: 1, eval: (args) => {
    const inputAst = args[0];
    if (inputAst.type == ASDF.array) {
      return Utils.JStoType(ASDF.number, Utils.TypetoJS(ASDF.array, inputAst).length);
    }
    else if (inputAst.type == ASDF.cartitems) {
      return Utils.JStoType(ASDF.number, Utils.TypetoJS(ASDF.cartitems, inputAst).length);
    }
    else {
      throw new ASDFProgramError(`count expects array or cartitems type`);
    }
  } },

  // cart_find_items(pricingIds: array) -> cartitems
  cart_find_items: { num: 1, eval: (args, data) => {
    // NOTE: This function will return actual referenced data.items, and no copies!
    // This means that we have to be careful with any cartitems instructions.
    // These should NOT modify any item contents, or else this will automatically update data.items itself!
    const pricingIds = Utils.TypetoJS(ASDF.array, args[0]);
    return Utils.JStoType(ASDF.cartitems, data.items.filter((item) => pricingIds.includes(item.price.id)));
  } },
  // cartitems_sort_by_amount(items: cartitems) -> cartitems
  cartitems_sort_by_amount: { num: 1, eval: (args) => {
    const items = Utils.TypetoJS(ASDF.cartitems, args[0]);
    items.sort((a, b) => a.price.amount - b.price.amount);
    return Utils.JStoType(ASDF.cartitems, items);
  } },

  // cart_calculate_total() -> number
  cart_calculate_total: { num: 0, eval: (args, data) => {
    return Utils.JStoType(ASDF.number, data.items.reduce((amount, item) => amount + item.price.amount, 0));
  } },
  // cart_count_items() -> number
  cart_count_items: { num: 0, eval: (args, data) => {
    return Utils.JStoType(ASDF.number, data.items.length);
  } },
  // cart_has_item(pricingId: string) -> number
  cart_has_item: { num: 1, eval: (args, data) => {
    const pricingId = Utils.TypetoJS(ASDF.string, args[0]);
    return Utils.JStoType(ASDF.number, data.items && (data.items.filter((p) => p.price.id == pricingId).length > 0) ? 1 : 0);
  } },
  // cart_get_item_amount(pricingId: string) -> number
  cart_get_item_amount: { num: 1, eval: (args, data) => {
    const pricingId = Utils.TypetoJS(ASDF.string, args[0]);
    const item = data.items ? data.items.filter((p) => p.price.id == pricingId) : [];
    if (item.length < 1) {
      throw new ASDFProgramError(`Item '${pricingId}' does not exist`);
    }
    return Utils.JStoType(ASDF.number, item[0].price.amount);
  } },
  // cart_set_items_amount(items: cartitems, amount: number|percent) -> cartitems
  cart_set_items_amount: { num: 2, eval: (args) => {
    const items = Utils.TypetoJS(ASDF.cartitems, args[0]);
    const amount = Utils.TypetoJS(ASDF.number, args[1], true), amountPercent = Utils.TypetoJS(ASDF.percent, args[1], true);
    // NOTE: Since items is NOT a copy but a reference to data.items,
    // we will modify items right here, effectively causing direct changes to data.items!
    if (amount == undefined && amountPercent == undefined) {
      throw new ASDFProgramError(`cart_set_items_amount expected number or percent`);
    }
    return Utils.JStoType(ASDF.cartitems, items.map((item) => {
      item.price.amount = amount ? amount : (amountPercent * item.price.amount);
      return item;
    }));
  } },
  // cart_set_item_amount(pricingId: string, amount: number|percent) -> number
  cart_set_item_amount: { num: 2, eval: (args, data) => {
    const pricingId = Utils.TypetoJS(ASDF.string, args[0]);
    const amount = Utils.TypetoJS(ASDF.number, args[1], true), amountPercent = Utils.TypetoJS(ASDF.percent, args[1], true);
    if (amount == undefined && amountPercent == undefined) {
      throw new ASDFProgramError(`cart_set_item_amount expected number or percent`);
    }
    let found = false, total = 0;
    for (let p of data.items) {
      if (p.price.id == pricingId) {
        p.price.amount = amount ? amount : (amountPercent * p.price.amount)
        found = true;
      }
      if (!Number.isFinite(p.price.amount)) {
        throw new ASDFProgramError(`Product ${JSON.stringify(p)} does not have a valid amount`);
      }
      total += p.price.amount;
    }
    return Utils.JStoType(ASDF.number, found ? 1 : 0);
  } },
  // cart_set_all_items_amount(amount: number|percent) -> number(1)
  cart_set_all_items_amount: { num: 1, eval: (args, data) => {
    const amount = Utils.TypetoJS(ASDF.number, args[0], true), amountPercent = Utils.TypetoJS(ASDF.percent, args[0], true);
    if (amount == undefined && amountPercent == undefined) {
      throw new ASDFProgramError(`cart_set_all_items_amount expected number or percent`);
    }
    let total = 0;
    for (let p of data.items) {
      p.price.amount = amount ? amount : (amountPercent * p.price.amount)
      total += p.price.amount;
    }
    return Utils.JStoType(ASDF.number, 1);
  } },
  // cart_add_item(pricingId: string) async -> number(1)
  cart_add_item: { num: 1, eval: async (args, data) => {
    const pricingId = Utils.TypetoJS(ASDF.string, args[0]);
    data.items.push(await CustomFunctions.getItem(
      { id: pricingId }
    ));
    return Utils.JStoType(ASDF.number, 1);
  } },
  // cart_set_total(amount: number|percent) -> number
  cart_set_total: { num: 1, eval: (args, data) => {
    const amount = Utils.TypetoJS(ASDF.number, args[0], true), amountPercent = Utils.TypetoJS(ASDF.percent, args[0], true);
    if (amount == undefined && amountPercent == undefined) {
      throw new ASDFProgramError(`cart_set_total expected number or percent`);
    }
    data.total = Utils.calcTotal(amount ? amount : (amountPercent * data.total));
    return Utils.JStoType(ASDF.number, data.total);
  } },
  // cart_get_total() -> number
  cart_get_total: { num: 0, eval: (args, data) => {
    return Utils.JStoType(ASDF.number, data.total);
  } },
  // cart_add_discount(amount: number) -> number
  cart_add_discount: { num: 1, eval: (args, data) => {
    const amount = Utils.TypetoJS(ASDF.number, args[0]);
    data.discount += Utils.calcTotal(amount);
    return Utils.JStoType(ASDF.number, data.discount);
  } }

  /* TODO: Possible future functions */
  // cart_has_promo(promoName:string)
  // cart_has_coupon(couponId:string)
  // user_has_purchase(productId:string)
};

/*
  Parser

  The parser is responsible for turning the list of tokens into an Abstract Syntax Tree.

  The grammar for this parser can be found in the README file.
*/

const parse = tokens => {
  let c = 0;
  const peek = () => tokens[c];
  const consume = () => tokens[c++];

  const parseNumber = () => ({ val: Number(consume()), type: ASDF.number });
  const parsePercent = () => ({ val: Number(consume().slice(0, -1) / 100), type: ASDF.percent });
  const parseString = () => ({ val: String(consume()).slice(1, -1), type: ASDF.string });

  const parseVar = () => {
    return { val: consume(), type: ASDF.var };
  }

  const parseOp = () => {
    const node = { val: consume(), type: ASDF.op, expr: [] };

    // Check for valid operator
    if (!ops[node.val]) {
      throw new ASDFSyntaxError(`${node.val} is not a valid operator`);
    }

    const numOperands = ops[node.val].num;
    const endOperator = ops[node.val].end;
    const conditional = ops[node.val].conditional;
    const isComment = ops[node.val].comment ? true : false;

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
        // Check if operator is a comment
        if (isComment) {
          // Just consume this token (does not parse at all)
          consume();
        }
        else {
          // Parse this token and add as child
          node.expr.push(parseExpr());
        }
      }
      // Consume end operator
      parseExpr();
    }
    else if (conditional) {
      // Conditional operator: 2 operators (condition, clause)
      node.expr.push({ type: ASDF.conditionalop, expr: [ parseExpr() ] });
      node.expr.push({ type: ASDF.ifbodyop, expr: [ parseExpr() ] });
    }
    else {
      // Operator without further use
    }
    return node;
  };

  // Expression parser
  const parseExpr = () => {
    if (/^[-+]?[0-9]*\.?[0-9]+$/.test(peek())) {
      return parseNumber();
    }
    else if (/^[-+]?[0-9]*\.?[0-9]+%$/.test(peek())) {
      return parsePercent();
    }
    else if (/'.*'/.test(peek())) {
      return parseString();
    }
    else if (ops[peek()]) {
      return parseOp();
    }
    else {
      // Must be a variable
      // If it is not, evaluate will throw an error
      return parseVar();
    }
  };

  // Always evaluate input as code block so multiple expressions at top level are supported
  const node = { val: "{", type: ASDF.op, expr: [] };
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

  // Evaluate immediate values immediately, return AST
  if (ast.type === ASDF.number) {
    return ast;
  }
  else if (ast.type == ASDF.percent) {
    return ast;
  }
  else if (ast.type == ASDF.string) {
    return ast;
  }
  else if (ast.type == ASDF.cartitems) {
    return ast;
  }
  else if (ast.type == ASDF.var) {
    // This must be a variable (or an invalid token), so try to see if it is indeed set in vars memory
    if (String(ast.val) in data.vars) {
      // The AST is stored in vars memory, so retrieve its value which must've been evaluated at this point
      return data.vars[ast.val];
    }
    else {
      // No such variable
      throw new ASDFProgramError(`Unknown variable or operation ${ast.val}`);
    }
  }

  // Check for custom AST walk function that needs to be called instead of normal AST walk
  if (ast.val && ops[ast.val].walk) {
    return await ops[ast.val].walk(ast.expr, ast, data);
  }
  else {
    // Use standard recursive AST walk, evaluating all (asynchronous) ASTs sequentially after one another
    let q = [];
    for (const p of ast.expr) {
      q.push(await evaluate(p, data));
    }
    // If operation is defined
    if (ast.val && ops[ast.val].eval) {
      // Parse expression, resolve Promise
      const e = await ops[ast.val].eval(q, data);
      // Ensure valid AST was returned by eval and return
      if (e) {
        if (!e.type) {
          throw new ASDFInternalError(`No valid AST returned by instruction ${ast.val}`);
        }
      }
      return e;
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

    // Prepare variable memory (stores ASTs of values)
    data.vars = {};

    // Evaluate AST
    await evaluate(ast, data);

    // Extra validity checks
    {
      // Ensure discount is a positive integer or 0
      if (!(Number.isFinite(data.discount) && data.discount >= 0)) {
        throw new ASDFProgramError(`Discount is not valid: ${data.discount}`);
      }
      // Ensure total is a positive integer or 0
      if (!(Number.isFinite(data.total) && data.total >= 0)) {
        throw new ASDFProgramError(`Total is not valid: ${data.total}`);
      }
      // Ensure discount is never greater than total
      if (data.discount > data.total) {
        throw new ASDFProgramError(`Discount (${data.discount}) is greater than total (${data.total})`);
      }
    }

    return data;
  }
}
