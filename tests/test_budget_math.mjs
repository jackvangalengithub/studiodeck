import assert from 'node:assert/strict';
import {budgetAmount,budgetTotal} from '../public/assets/budget.js';
const rows=[{id:'a',amount_cents:10000},{id:'b',min_amount_cents:100000,max_amount_cents:200000,range_percent:50},{id:'c',amount_cents:25000,is_optional:1,selected:false},{id:'d',amount_cents:4000,parent_id:'a',included:1},{id:'e',amount_cents:null}];
assert.equal(budgetTotal(rows),160000);rows[2].selected=true;assert.equal(budgetTotal(rows),185000);
assert.equal(budgetTotal(rows,0),135000);assert.equal(budgetTotal(rows,100),235000);
assert.equal(budgetAmount(rows[4]),null);assert.equal(budgetAmount({amount_cents:0}),0);
rows.push({id:'f',amount_cents:1000,parent_id:'c'});rows[2].selected=false;assert.equal(budgetTotal(rows),160000);
assert.equal(budgetAmount({min_amount_cents:100,max_amount_cents:101,range_percent:50}),101);
console.log('PASS fixed, optional, ranged, unspecified and nested budget calculations.');
