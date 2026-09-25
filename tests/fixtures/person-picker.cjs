// Exercise the visible person control instead of setting its backing select.
module.exports=async function choosePerson(page,form,field,email){
 const wrap=form.locator('[data-person-picker]').filter({has:page.locator(`[name=${field}]`)});
 if(!await wrap.isVisible())await form.locator('[data-compose-waiting]').click();
 const chip=wrap.locator('[data-person-chip]');
 if(await chip.getAttribute('aria-expanded')!=='true')await chip.click();
 const search=page.locator('.comm-person-popover [role=combobox]');
 await search.fill(email);await search.press('Enter');
};
