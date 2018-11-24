/**
 * ASDFLanguage
 *
 * TODOs
 *
 * * CartItems array type: find, sort, slice
 * * Catch invalid tokens, e.g. with commas [ 'test', 'test' ], and error out instead of parsing them.
 * * Catch not enough arguments
 * * Parentheses
 * * Variable assignment
 * * Infix
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
  getItem: async ({ id }) => { throw new ASDFInternalError('CustomFunctions.getItem not defined') }
};

/*
  Operators

  All operators symbols and tables are defined here.
*/
const Op = Symbol('op');
const Array = Symbol('array');
const Var = Symbol('var');

// Immediate operators (cannot contain any children ASTs)
const Num = Symbol('num');
const NumPercent = Symbol('numpercent');
const Str = Symbol('str');
const CartItems = Symbol('cartitems');

// Internal parse/eval only (non-specifiable) operators
const ConditionalOp = Symbol('conditionalop');
const IfBodyOp = Symbol('ifbodyop');

const Utils = {
  // Avoids floating point rounding numbers and guarantees exact definitions for 2 fraction digits
  toFixedPrecision2: (x) => Number(x.toFixed(2)),
  // Calculates a total amount properly
  calcTotal: (x) => Utils.toFixedPrecision2(x),

  // Convert from JS to specific type
  JStoType: (type, x) => {
    if (type == Num) {
      return { val: Number(x), type: Num };
    }
    else if (type == NumPercent) {
      return { val: Number(x), type: NumPercent };
    }
    else if (type == Str) {
      return { val: String(x), type: Str };
    }
    else if (type == Array) {
      return { val: x, type: Array };
    }
    else if (type == CartItems) {
      return { val: x, type: CartItems };
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
        return null;
      }
    }
    if (ast.type == Num) {
      return Number(ast.val);
    }
    else if (ast.type == NumPercent) {
      return Number(ast.val);
    }
    else if (ast.type == Str) {
      return String(ast.val);
    }
    else if (ast.type == Array) {
      return ast.val.map((x) => x.val);
    }
    else if (ast.type == CartItems) {
      return ast.val; // Mimics data.items, val doesn't contain any ASTs
    }
    else {
      throw new ASDFInternalError(`Unknown type ${type.toString()}`);
    }
  }
};

const ops = {
  add:  { num: 2, eval: args => Utils.JStoType(Num, Utils.TypetoJS(Num, args[0]) + Utils.TypetoJS(Num, args[1])) },
  sub:  { num: 2, eval: args => Utils.JStoType(Num, Utils.TypetoJS(Num, args[0]) - Utils.TypetoJS(Num, args[1])) },
  div:  { num: 2, eval: args => Utils.JStoType(Num, Utils.TypetoJS(Num, args[0]) / Utils.TypetoJS(Num, args[1])) },
  mul:  { num: 2, eval: args => Utils.JStoType(Num, Utils.TypetoJS(Num, args[0]) * Utils.TypetoJS(Num, args[1])) },

  // Conditional instructions
  if: {
    conditional: true,
    eval: args => {
      return Utils.JStoType(Num, Number(args[0].val) ? args[1].val : 0);
    },
    // Custom walk function, is needed so that conditionals expressions are never automatically evaluated
    walk: async (p, ast, data) => {
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
  
  // Variable assignment instructions
  set: { num: 2,
    // Custom walk function to evaluate and set variables in memory
    walk: async (p, ast, data) => {
    // Internal AST validity check (debugging)
    if (!(p.length >= 2 && p[0].type == Var)) {
      throw new ASDFProgramError(`set is trying to set a wrong type ${p[0].type.toString()}`);
    }
    const varName = p[0].val; // Var
    const varValueExpr = p[1];
    
    // Evaluate value expression
    const varValue = await evaluate(varValueExpr, data);
    
    // Assign to var in vars memory
    data.vars[varName] = varValue;
    return varValue;
  } },
  
  // Array instructions
  '[': { end: ']', eval: (args) => Utils.JStoType(Array, args) },
  ']': {},

  // Comment block instructions
  '/*': { end: '*/', comment: true },
  '*/': {},

  // Code block instructions
  '{': { end: '}' },
  '}': {},

  // Comparison instructions
  '>': { num: 2, eval: (args) => Utils.JStoType(Num, args[0].val > args[1].val) },
  '<': { num: 2, eval: (args) => Utils.JStoType(Num, args[0].val < args[1].val) },
  '>=': { num: 2, eval: (args) => Utils.JStoType(Num, args[0].val >= args[1].val) },
  '<=': { num: 2, eval: (args) => Utils.JStoType(Num, args[0].val <= args[1].val) },
  '==': { num: 2, eval: (args) => Utils.JStoType(Num, args[0].val == args[1].val) },
  '!=': { num: 2, eval: (args) => Utils.JStoType(Num, args[0].val != args[1].val) },
  
  // Array instructions
  
  // slice(input: Array|CartItems, begin: Num, end: Num) -> Array|CartItems
  slice: { num: 3, eval: (args) => {
    const inputAst = args[0];
    const begin = Number(Utils.TypetoJS(Num, args[1]));
    const end = Number(Utils.TypetoJS(Num, args[2]));
    let input;
    if (inputAst.type == Array) {
      return Utils.JStoType(Array, Utils.TypetoJS(Array, inputAst).slice(begin, end));
    }
    else if (inputAst.type == CartItems) {
      return Utils.JStoType(CartItems, Utils.TypetoJS(CartItems, inputAst).slice(begin, end));
    }
    else {
      throw new ASDFProgramError(`slice expects Array or CartItems type`);
    }
  } },

  // cart_find_items(pricingIds: Array) -> CartItems
  cart_find_items: { num: 1, eval: (args, data) => {
    // NOTE: This function will return actual referenced data.items, and no copies!
    // This means that any future instructions that modify any item contents will automatically update data.items itself!
    const pricingIds = Utils.TypetoJS(Array, args[0]);
    return Utils.JStoType(CartItems, data.items.filter((item) => pricingIds.includes(item.price.id)));
  } },
  // cartitems_sort_by_amount(items: CartItems) -> CartItems
  cartitems_sort_by_amount: { num: 1, eval: (args) => {
    const items = Utils.TypetoJS(CartItems, args[0]);
    items.sort((a, b) => a.price.amount - b.price.amount);
    return Utils.JStoType(CartItems, items);
  } },
  // cartitems_set_amount(items: CartItems, amount: Num|NumPercent) -> CartItems
  cartitems_set_amount: { num: 2, eval: (args) => {
    const items = Utils.TypetoJS(CartItems, args[0]);
    const amount = Utils.TypetoJS(Num, args[1], true), amountPercent = Utils.TypetoJS(NumPercent, args[1], true);
    if (amount == null && amountPercent == null) {
      throw new ASDFProgramError(`cartitems_set_amount expected Num or NumPercent`);
    }
    return Utils.JStoType(CartItems, items.map((item) => {
      item.price.amount = amount ? amount : (amountPercent * item.price.amount);
      return item;
    }));
  } },

  // HACK
  // cart_get_items_amount(pricingIds: Array, minItemsToGet: Num, maxItemsToGet: Num) -> Num
  cart_get_items_amount: { num: 3, eval: (args, data) => {
    const pricingIds = args[0].val.map((x) => x.val); // Array AST to JS conversion
    const minItemsToGet = args[1].val;
    const maxItemsToGet = args[2].val;
    // Find all matching items
    let foundItems = data.items.filter((item) => pricingIds.includes(item.price.id));
    let result = 0;
    if (foundItems.length >= minItemsToGet) {
      // Just use the first N items, forget about the rest (HACK: will cause problems with items that have differing prices!)
      result = foundItems.slice(0, maxItemsToGet).reduce((amount, item) => amount + item.price.amount, 0);
    }
    else {
      // Not enough items found, no summed amount
    }
    return Utils.JStoType(Num, result);
  } },
  // cart_calculate_total() -> Num
  cart_calculate_total: { num: 0, eval: (args, data) => {
    return Utils.JStoType(Num, data.items.reduce((amount, item) => amount + item.price.amount, 0));
  } },
  // cart_count_items() -> Num
  cart_count_items: { num: 0, eval: (args, data) => {
    return Utils.JStoType(Num, data.items.length);
  } },
  // cart_has_item(pricingId: Str) -> Num
  cart_has_item: { num: 1, eval: (args, data) => {
    const pricingId = args[0].val;
    return Utils.JStoType(Num, data.items && (data.items.filter((p) => p.price.id == pricingId).length > 0) ? 1 : 0);
  } },
  // cart_get_item_amount(pricingId: Str) -> Num
  cart_get_item_amount: { num: 1, eval: (args, data) => {
    const pricingId = args[0].val;
    const item = data.items ? data.items.filter((p) => p.price.id == pricingId) : [];
    if (item.length < 1) {
      throw new ASDFProgramError(`Item '${pricingId}' does not exist`);
    }
    return Utils.JStoType(Num, item[0].price.amount);
  } },
  // cart_set_item_amount(pricingId: Str, amount: Num|NumPercent)
  cart_set_item_amount: { num: 2, eval: (args, data) => {
    const pricingId = args[0].val;
    const amount = Utils.TypetoJS(Num, args[1], true), amountPercent = Utils.TypetoJS(NumPercent, args[1], true);
    if (amount == null && amountPercent == null) {
      throw new ASDFProgramError(`cart_set_item_amount expected Num or NumPercent`);
    }
    let found = false, total = 0;
    for (let p of data.items) {
      if (p.price.id == args[0].val) {
        p.price.amount = amount ? amount : (amountPercent * p.price.amount)
        found = true;
      }
      if (!Number.isFinite(p.price.amount)) {
        throw new ASDFProgramError(`Product ${JSON.stringify(p)} does not have a valid amount`);
      }
      total += p.price.amount;
    }
    return Utils.JStoType(Num, found ? 1 : 0);
  } },
  // cart_set_all_items_amount(amount: Num|NumPercent)
  cart_set_all_items_amount: { num: 1, eval: (args, data) => {
    const amount = Utils.TypetoJS(Num, args[0], true), amountPercent = Utils.TypetoJS(NumPercent, args[0], true);
    if (amount == null && amountPercent == null) {
      throw new ASDFProgramError(`cart_set_all_items_amount expected Num or NumPercent`);
    }
    let total = 0;
    for (let p of data.items) {
      p.price.amount = amount ? amount : (amountPercent * p.price.amount)
      total += p.price.amount;
    }
    return Utils.JStoType(Num, 1);
  } },
  // cart_add_item(pricingId: Str) async
  cart_add_item: { num: 1, eval: async (args, data) => {
    data.items.push(await CustomFunctions.getItem(
      { id: String(args[0].val) }
    ));
    return Utils.JStoType(Num, 1);
  } },
  // cart_set_total(amount: Num|NumPercent) -> Num
  cart_set_total: { num: 1, eval: (args, data) => {
    const amount = Utils.TypetoJS(Num, args[0], true), amountPercent = Utils.TypetoJS(NumPercent, args[0], true);
    if (amount == null && amountPercent == null) {
      throw new ASDFProgramError(`cart_set_total expected Num or NumPercent`);
    }
    data.total = Utils.calcTotal(amount ? amount : (amountPercent * data.total));
    return Utils.JStoType(Num, data.total);
  } },
  // cart_get_total() -> Num
  cart_get_total: { num: 0, eval: (args, data) => {
    return Utils.JStoType(Num, data.total);
  } },
  // cart_add_discount(amount: Num)
  cart_add_discount: { num: 1, eval: (args, data) => {
    const amount = args[0].val;
    data.discount += Utils.calcTotal(amount);
    return Utils.JStoType(Num, data.discount);
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
  op := add | sub | div | mul | if | { | } | \/\* | \*\/ | ...
  expr := num | numpercent | 'str' | op expr+
  ```
*/

const parse = tokens => {
  let c = 0;
  const peek = () => tokens[c];
  const consume = () => tokens[c++];

  const parseNum = () => ({ val: Number(consume()), type: Num });
  const parseNumPercent = () => ({ val: Number(consume().slice(0, -1) / 100), type: NumPercent });
  //const parseStr = () => ({ val: String(consume()).slice(1, -1), type: Str });
  const parseStr = () => {
    const c = consume();
    return ({ val: String(c).slice(1, -1), type: Str });
  }

  const parseVar = () => {
    return { val: consume(), type: Var };
  }

  const parseOp = () => {
    const node = { val: consume(), type: Op, expr: [] };

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

  // Evaluate immediate values immediately, return AST
  if (ast.type === Num) {
    return ast;
  }
  else if (ast.type == NumPercent) {
    return ast;
  }
  else if (ast.type == Str) {
    return ast;
  }
  else if (ast.type == CartItems) {
    return ast;
  }
  else if (ast.type == Var) {
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
