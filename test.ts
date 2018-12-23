import { ASDFInterpreter } from "./ASDFLanguage";
import { ASDFSyntaxError, ASDFInternalError, ASDFProgramError } from "./ASDFLanguage";

/*
  Main

  Test program.
*/
(async () => {
  try {
    // Input data
    const input = {
      user: "1234",
      items: [
        {
          id: 1,
          price: {
            id: "compressor",
            amount: 5
          }
        },
        {
          id: 2,
          price: {
            id: "bitcrusher",
            amount: 4
          }
        },
        {
          id: 3,
          price: {
            id: "noize",
            amount: 3
          }
        },
        {
          id: 4,
          price: {
            id: "nogwatx",
            amount: 2
          }
        },
        {
          id: 5,
          price: {
            id: "transient",
            amount: 1
          }
        },
      ],
      total: 0,
      discount: 0,
      coupons: [ "bassxl" ]
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
/* Find matching purchased products */
set purchasedItems user_find_items [ 'b' 'd' 'x' 'y' 'z' ]

/* Check if there are at least 3 matching products */
if >= count purchasedItems 1 {
  /* Add "free" item */
  cart_add_item 'bassxl'

  /* Set 0 price amount for "free" item */
  cart_set_item_amount 'bassxl' 0
}
`;

    // Async timer test logic
    const timeout = (ms) => {
        return new Promise(resolve => setTimeout(resolve, ms));
    };

    // Run the actual program on the input data
    const output = await ASDFInterpreter.run(input, source, {
      getItem: async ({ id }) => {
        console.log("getItem start timer");
        await timeout(1000);
        console.log("getItem executed timer");
        return {
          id: 9999,
          price: {
            id: "bassxl",
            amount: 15
          }
        };
      },
      getUserPricings: async ({ user }) => {
        // Check if user is valid
        if (user) {
          return [ "a", "b", "c", "d" ];
        }
        else {
          return [];
        }
      }
    });

    // Log the output
    console.log(JSON.stringify(output));
  }
  catch (e) {
    console.error(e);
  }
})();
