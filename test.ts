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
            amount: 10
          }
        },
        {
          id: 2,
          price: {
            id: 'bitcrusher',
            amount: 10
          }
        },
        {
          id: 3,
          price: {
            id: 'noize',
            amount: 10
          }
        },
        {
          id: 4,
          price: {
            id: 'wtvr',
            amount: 10
          }
        },
        {
          id: 5,
          price: {
            id: 'transient',
            amount: 10
          }
        },
      ],
      total: 0,
      discount: 0
    };

    // ASDF program source
    /*
    const source = `
if cart_get_items_amount [ 'bitcrusher' 'noize' 'transient' 'nogwat' 'nogietswatnietbestaat', 'bassxl' ] 3 3 {
  cart_add_discount sub cart_get_items_amount [ 'bitcrusher' 'noize' 'transient' 'nogwat' 'nogietswatnietbestaat', 'bassxl', 'compressor' ] 3 3 20
  cart_add_item 'bassxl'
  cart_add_discount cart_get_item_amount 'bassxl'
}
cart_set_total cart_calculate_total
`;
    */
    const source = `
set foundItems cart_find_items [ 'bitcrusher' 'noize' 'transient' 'nogwat' 'nogietswatnietbestaat', 'bassxl' ]
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
            amount: 15
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
