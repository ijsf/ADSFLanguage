let { ASDFInterpreter } = require('./ASDFLanguage');
let { ASDFSyntaxError, ASDFASTError, ASDFProgramError } = require('./ASDFLanguage');

/*
  Main

  Test program.
*/
(async () => {
  try {
    // Input data
    const input = {
      items: [
        {
          id: 'compressor',
          amount: 15.00
        },
        {
          id: 'bitcrusher',
          amount: 15.00
        },
        {
          id: 'noize',
          amount: 15.00
        },
      ],
      total: 45,
      discount: 0
    };

    // ASDF program source
    const source = `
if >= cart_count_items 3 {
  cart_add_item 'bassxl'
  cart_add_discount cart_get_item_amount 'bassxl'
}
`;

    // Run the actual program on the input data
    const output = await ASDFInterpreter.run(input, source);
    
    // Log the output
    console.log(output);
  }
  catch (e) {
    console.error(e);
  }
})();
