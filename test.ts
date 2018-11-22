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
        {
          id: 4,
          price: {
            id: 'wtvr',
            amount: 35.00
          }
        },
        {
          id: 5,
          price: {
            id: 'transient',
            amount: 15.00
          }
        },
      ],
      total: 95,
      discount: 0
    };

    // ASDF program source
    const source = `
if cart_get_items_amount [ 'bitcrusher' 'noize' 'transient' 'nogwat' 'nogietswatnietbestaat', 'bassxl' ] 3 {
  cart_add_discount cart_get_items_amount [ 'bitcrusher' 'noize' 'transient' 'nogwat' 'nogietswatnietbestaat', 'bassxl' ] 3
  cart_add_item 'bassxl'
  cart_add_discount cart_get_item_amount 'bassxl'
}
`;

    // Async timer test logic
    let timeout = (ms) => {
        return new Promise(resolve => setTimeout(resolve, ms));
    };

    // Run the actual program on the input data
    const output = await ASDFInterpreter.run(input, source, {
      getItem: async ({ id }) => {
        console.log('getItem start timer');
        await timeout(1000);
        console.log('getItem executed timer');
        return {
          id: 9999,
          price: {
            id: 'bassxl',
            amount: 30
          }
        };
      }
    });
    
    // Log the output
    console.log(JSON.stringify(output));
  }
  catch (e) {
    console.error(e);
  }
})();
