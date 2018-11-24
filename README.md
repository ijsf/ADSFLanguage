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

## Example cases

Black Friday discount:

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

## Technical details

Features:

* Lisp-like language -- prefix notation.
* Asynchronous instructions -- Promise based to support async database queries, etc.
* Comment blocks ```/* ... */```.
* If conditional expressions.
* Num type 
* TypeScript interpreter.

Missing functionality:

* Catch invalid tokens, e.g. with commas [ 'test', 'test' ], and error out instead of parsing them.
* Catch not enough arguments.
* Multiple #arguments for same instruction.
* Parentheses (argument stack/queue).
* Infix? (argument stack/queue).

Grammar:

```
  Modified EBNF grammar using regex (denoted by _).

  num := _0-9+_
  numpercent := _0-9+_%
  str := '_.*_'
  array := [ expr ]

  comment := /* _.*_ */
  var := _.*_
  identifier := ops | if | { | } | comment | var

  expr := num | numpercent | array | str | identifier expr+
```
