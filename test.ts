import { ASDFInterpreter } from './ASDFLanguage';
import { ASDFSyntaxError, ASDFInternalError, ASDFProgramError } from './ASDFLanguage';

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
          id: 1,
          price: {
            id: 'compressor',
            amount: 15.00
          }
        },
        {
          id: 2,
          price: {
            id: 'bitcrusher',
            amount: 15.00
          }
        },
        {
          id: 3,
          price: {
            id: 'noize',
            amount: 15.00
          }
        },
      ],
      total: 45,
      discount: 0
    };

    // ASDF program source
    const source = `
if >= cart_count_items 3 {
  cart_add_discount cart_get_item_amount 'bassxl'
}
`;

    // Run the actual program on the input data
    const output = await ASDFInterpreter.run(input, source, {
    });
    
    // Log the output
    console.log(output);
  }
  catch (e) {
    console.error(e);
  }
})();
