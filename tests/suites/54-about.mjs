// The About OpenSchem guide: opened from the Help menu and the address, page list, links, previous and next.
export const tests = {
  'about: the guide opens from Help with the version, page list, links and previous and next': async t => {
    await t.open('#ind');
    await t.page.click('.menu[data-menu="help"]'); await t.page.click('#dropdown [data-act="about"]');
    t.ok(await t.eval(() => $('#dlg').open && $('.abhead').textContent.includes('Version ' + APP_VERSION)), 'header with version');
    t.eq(await t.eval(() => [...document.querySelectorAll('.abtoc a')].map(a => a.textContent)), await t.eval(() => ABOUT_PAGES.map(p => p.title)));
    t.ok(await t.eval(() => $('.abpage h1').textContent === 'Overview' && $('.abpage table') !== null), 'overview with its table');
    await t.page.click('.abpage a[data-about="decks"]');
    t.eq(await t.eval(() => [$('.abpage h1').textContent, $('.abtoc a.on').textContent]), ['Decks', 'Decks']);
    await t.page.click('.abpager a:last-child');
    t.eq(await t.eval(() => $('.abpage h1').textContent), 'Tile layouts');
    await t.page.click('.abtoc a[data-about="release-notes"]');
    t.ok(await t.eval(() => $('.abpage h2').textContent.startsWith(APP_VERSION)), 'newest release note first');
    await t.page.click('#dlgbtns .primary');
    await t.open('#about/technical'); await t.page.waitForFunction(() => $('#dlg').open && $('.abpage h1'));
    t.ok(await t.eval(() => $('#dlg').open && $('.abpage h1').textContent === 'Technical'), 'opens from the address');
  },
};
