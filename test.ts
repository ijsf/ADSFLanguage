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
            id: 'bassxl',
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
cart_discount_items [ 'bitcrusher' 'noize' 'transient' 'nogwat' 'nogietswatnietbestaat', 'bassxl' ] 3
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
          id: 'test',
          price: {
            id: 'test',
            amount: 999
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
