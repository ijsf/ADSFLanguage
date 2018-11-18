/*
  # Lexer

  The lexer is responsible for turning the input string into
  a list of tokens. Usually a token looks the following way:

  ```javascript
  {
    "type": Symbol("Operator"),
    "value: "-"
  }
  ```

  In our case we're keeping everything simplified and store
  only the token's value. We can infer the type based on
  regular expressions defined below.

  In short, `lex` will turn the following expression:

  ```
  mul 3 sub 2 sum 1 3 4
  ```

  To the following array:

  ```
  ["mul", "3", "sub", "2", "sum", "1", "3", "4"]
  ```
*/
const lex = str => str.split(' ').map(s => s.trim()).filter(s => s.length);

/*
  Operators
*/
const Op = Symbol('op');
const Num = Symbol('num');
const Str = Symbol('str');

const ops = {
  sum:  { num: 2, parse: args => args.reduce((a, b) => Number(a) + Number(b), 0) },
  sub:  { num: 2, parse: args => args.reduce((a, b) => Number(a) - Number(b)) },
  div:  { num: 2, parse: args => args.reduce((a, b) => Number(a) / Number(b)) },
  mul:  { num: 2, parse: args => args.reduce((a, b) => Number(a) * Number(b), 1) },
  
  if:   { num: 2, parse: args => {
    return Number(args[0]) ? Number(args[1]) : 0;
  } },

  // cart_has_item(pricingId: Str) -> Num
  cart_has_item: { num: 1, parse: (args, data) => {
    return data.prices && (data.prices.filter((p) => p.id == args[0]).length > 0) ? 1 : 0;
  } },
  // cart_set_item_amount(pricingId: Str, amount: Num)
  // cart_set_item_amount(pricingId: Str, percentage: Str)
  cart_set_item_amount: { num: 2, parse: (args, data) => {
  } },
  // cart_set_all_items_amount(pricingId: Str, amount: Num)
  // cart_set_all_items_amount(pricingId: Str, percentage: Str)
  cart_set_all_items_amount: { num: 1, parse: (args, data) => {
  } },
  // cart_add_item(pricingId: Str)
  cart_add_item: { num: 1, parse: async (args, data) => {
    data.prices.push({
      id: args[0]
    });
  } }
  
  // cart_has_coupon(couponString)
  // user_has_purchase(productId)
  
  // block
};

/*
  Errors
*/
function TelSellSyntaxError(message) {
    this.name = "TelSellSyntaxError";
    this.message = (message || "");
}
TelSellSyntaxError.prototype = Error.prototype;

function TelSellProgramError(message) {
    this.name = "TelSellProgramError";
    this.message = (message || "");
}
TelSellProgramError.prototype = Error.prototype;

/*
  # Parser

  The parser is responsible for turning the list of tokens
  into an AST or Abstract Syntax Tree. In the example below
  we use recursive descent parsing to produce the AST
  from the input token array.

  Visually, the parsing is a process which turns the array:

  ```javascript
  const tokens = ["sub", "2", "sum", "1", "3", "4"];
  ```

  to the following tree:

  ```
   sub
   / \
  2  sum
     /|\
    1 3 4
  ```

  The parser uses the following grammar to parse the input token array:

  ```
  num := 0-9+
  op := sum | sub | div | mul
  expr := num | op expr+
  ```

  This translated to plain English, means:
  - `num` can be any sequence of the numbers between 0 and 9.
  - `op` can be any of `sum`, `sub`, `div`, `mul`.
  - `expr` can be either a number (i.e. `num`) or an operation followed by one or more `expr`s.

  Notice that `expr` has a recursive declaration.
*/

const parse = tokens => {

  let c = 0;
  const peek = () => tokens[c];
  const consume = () => tokens[c++];

  const parseNum = () => ({ val: parseInt(consume()), type: Num });

  const parseOp = () => {
    const node = { val: consume(), type: Op, expr: [] };
    
    // Check for valid operator
    if (!ops[node.val]) {
      throw new TelSellSyntaxError(`${node.val} is not a valid operator`);
    }
    
    // Consume operands according to specified # of defined operands
    const numOperands = ops[node.val].num;
    console.log(`>>> '${node.val}' with '${numOperands}' operands`);
    for (let i = 0; i < numOperands; i++) {
      // Check for operand
      console.log(`  ${i}: ` + peek());
      if (!peek()) {
        throw new TelSellSyntaxError(`${node.val} requires ${numOperands} operands`);
      }
      // Parse operand
      node.expr.push(parseExpr());
    }
    console.log(`<<<`);
    return node;
  };

  const parseExpr = () => /\d/.test(peek()) ? parseNum() : parseOp();

  return parseExpr();
};

/*
  # Evaluator

  Finally, this is our evaluator. In it we simply visit each node
  from the tree with pre-order traversal and either:

  - Return the corresponding value, in case the node is of type number.
  - Perform the corresponding arithmetic operation, in case of an operation node.
*/
const evaluate = async (ast, data) => {
  console.log("* " + JSON.stringify(ast));

  if (ast.type === Num) return ast.val;
  console.log("expr", ast.expr);
  //return await ops[ast.val].parse(ast.expr.map(evaluate));

  // Resolve any Promises in expressions
  const p = await Promise.all(ast.expr);
  // Recursive call, resolve all Promises
  const q = await Promise.all(p.map((p) => evaluate(p, data)));
  // Parse expression, resolve Promise
  return await ops[ast.val].parse(q, data);
};

/*
  # Interpreter

  In order to interpret the input stream we feed the parser with the input
  from the lexer and the evaluator with the output of the parser.
*/
const run = async (input, program) => {
  // Validity checks
  if (!program) {
    throw new TelSellProgramError(`No valid program`);
  }
  if (!input) {
    throw new TelSellProgramError(`No valid input`);
  }
  
  // Construct AST
  const ast = parse(lex(program));
  
  // Copy input object to new data object that will be changed by evaluate
  let data = JSON.parse(JSON.stringify(input));
  
  // Evaluate AST
  await evaluate(ast, data);
  return data;
};


/*
  Main
*/
(async () => {
  try {
    const context = {
      input: {
        prices: [
          {
            id: 1000,
            amount: 15.00
          },
          {
            id: 1001,
            amount: 15.00
          },
          {
            id: 1002,
            amount: 15.00
          },
        ]
      },
      program: `
if cart_has_item 1000
  cart_add_item 9000
`
    };
    context.output = await run(context.input, context.program);
    console.log(context.output);
  }
  catch (e) {
    console.error(e);
  }
})();
