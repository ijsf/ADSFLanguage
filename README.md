# ASDF

ASDF: Domain specific language for Denise store backend promotion logic, implemented in ES6.

Build:

```
yarn build
```

Running the test application:

```
yarn start
```

Example ASDF code:

```
/* Find any matching products */
set foundItems cart_find_items [ 'compressor' 'noize' 'transient' 'nogwat' 'nogietswatnietbestaat', 'bassxl' ]

/* Check if there are at least 3 matching products */
if >= count foundItems 3 {
  /* Only consider the first 3 matching products when sorted by price amount */
  set foundItems
    slice
      cartitems_sort_by_amount foundItems
      0
      3
  
  /* Set the amount to our fixed amount */
  set foundItems
    cartitems_set_amount foundItems
      999
  
  /* Add "free" item */
  cart_add_item 'bassxl'
  
  /* Set 0 price amount for "free" item */
  cart_set_item_amount 'bassxl' 0
}
```