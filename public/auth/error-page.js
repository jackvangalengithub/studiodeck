import * as domView from "../assets/render.js";
const esc = value => String(value ?? '');
const copy = {
  en: {
    edition: 'A considered space',
    footer: 'Your design, beautifully together.',
    label: 'A different way forward',
    missing: 'This space isn’t available.',
    access: 'Let’s find your space.',
    session: 'Let’s get you signed in.',
    service: 'A little pause. We’ll be back.',
    invalid: 'This link needs another look.',
    expired: 'A fresh link, a new beginning.',
    description: 'We couldn’t open this page. The link may have changed, or this account may no longer have access.',
    serviceDescription: 'We’re having trouble opening this page right now. Please try again in a moment.',
    sessionDescription: 'Sign in again to continue to your projects and conversations.',
    expiredDescription: 'This sign-in link has expired or has already been used. Request a new link to continue.',
    choose: 'Your workspaces & projects',
    signin: 'Sign in',
    another: 'Use another email',
    retry: 'Try again',
    fresh: 'Get a new sign-in link',
    help: 'Expecting to find your project here?',
    helpText: 'Check that you’re using the email address your studio invited. You can also ask your studio for a new invitation.',
    serviceHelp: 'A moment to reconnect',
    serviceHelpText: 'Check your connection, then try again. If this continues, please come back a little later.',
    sessionHelp: 'The right email opens the right doors',
    sessionHelpText: 'Use the email address that received your project invitation.',
    account: 'Signed in as',
    website: 'This website isn’t available.',
    websiteDescription: 'This space is currently unavailable. Please check the address or come back a little later.',
    websiteHelp: 'Looking for the studio?',
    websiteHelpText: 'You can contact the studio directly for help finding their website.',
    home: 'Back to the website'
  },
  nl: {
    edition: 'Ruimte voor goed ontwerp',
    footer: 'Jouw ontwerp, prachtig samengebracht.',
    label: 'Een andere weg vooruit',
    missing: 'Deze ruimte is niet beschikbaar.',
    access: 'We helpen je op weg.',
    session: 'Meld je opnieuw aan.',
    service: 'Even pauze. We zijn zo terug.',
    invalid: 'Controleer deze link nog even.',
    expired: 'Een nieuwe link, een frisse start.',
    description: 'We konden deze pagina niet openen. De link is mogelijk gewijzigd, of dit account heeft geen toegang meer.',
    serviceDescription: 'We kunnen deze pagina op dit moment niet openen. Probeer het over een ogenblik opnieuw.',
    sessionDescription: 'Meld je opnieuw aan om verder te gaan naar je projecten en gesprekken.',
    expiredDescription: 'Deze inloglink is verlopen of al gebruikt. Vraag een nieuwe link aan om verder te gaan.',
    choose: 'Je werkruimtes en projecten',
    signin: 'Inloggen',
    another: 'Ander e-mailadres gebruiken',
    retry: 'Opnieuw proberen',
    fresh: 'Nieuwe inloglink aanvragen',
    help: 'Had je hier je project verwacht?',
    helpText: 'Controleer of je het e-mailadres gebruikt waarop je studio je heeft uitgenodigd. Je kunt je studio ook om een nieuwe uitnodiging vragen.',
    serviceHelp: 'Even opnieuw verbinden',
    serviceHelpText: 'Controleer je verbinding en probeer het opnieuw. Blijft het probleem bestaan? Kom dan later terug.',
    sessionHelp: 'Het juiste e-mailadres geeft toegang',
    sessionHelpText: 'Gebruik het e-mailadres waarop je de projectuitnodiging hebt ontvangen.',
    account: 'Ingelogd als',
    website: 'Deze website is niet beschikbaar.',
    websiteDescription: 'Deze website is momenteel niet beschikbaar. Controleer het adres of kom later terug.',
    websiteHelp: 'Op zoek naar de studio?',
    websiteHelpText: 'Neem rechtstreeks contact op met de studio om hun website te vinden.',
    home: 'Terug naar de website'
  }
};
export function errorPage(error = {}, {language = 'en', signedIn = false, email = '', kind = ''} = {}) {
  const c = copy[language] || copy.en, status = Number(error.status) || 0;
  kind = kind || (status >= 500 || !status ? 'service' : status === 401 ? 'session' : status === 403 ? 'access' : status === 400 ? 'invalid' : 'missing');
  const service = kind === 'service', session = kind === 'session' || kind === 'expired';
  const title = c[kind] || c.missing, description = service ? c.serviceDescription : session ? c[domView.concat(kind, 'Description')] : error.message || c.description;
  const primary = service ? domView.element("button", [{
    "type": "button"
  }, {
    "class": "status-button"
  }, {
    "data-error-retry": domView.text([])
  }], [domView.fragment([c.retry, " "]), domView.element("span", [{
    "aria-hidden": "true"
  }], ["↻"], false)], false) : domView.element("a", [{
    "class": "status-button"
  }, {
    "href": session || !signedIn ? '/login' : '/choose'
  }], [domView.fragment([kind === 'expired' ? c.fresh : session || !signedIn ? c.signin : c.choose, " "]), domView.element("span", [{
    "aria-hidden": "true"
  }], ["→"], false)], false);
  const secondary = service ? domView.element("a", [{
    "class": "status-button status-button-secondary"
  }, {
    "href": signedIn ? '/choose' : '/login'
  }], [signedIn ? c.choose : c.signin], false) : signedIn && !session ? domView.element("a", [{
    "class": "status-button status-button-secondary"
  }, {
    "href": "/login?returnTo=%2Fchoose"
  }], [c.another], false) : '';
  return domView.element("main", [{
    "class": "status-page"
  }, {
    "id": "main"
  }], [domView.element("header", [{
    "class": "status-header"
  }], [domView.element("a", [{
    "class": "status-brand"
  }, {
    "href": signedIn ? '/choose' : '/login'
  }], ["studio", domView.element("strong", [], ["deck"], false), domView.element("sup", [], ["®"], false)], false), domView.element("span", [{
    "class": "status-edition"
  }], [c.edition], false)], false), domView.element("div", [{
    "class": "status-layout"
  }], [domView.element("section", [{
    "class": "status-content"
  }, {
    "aria-labelledby": "status-title"
  }], [domView.element("p", [{
    "class": "status-eyebrow"
  }], [c.label], false), domView.element("h1", [{
    "id": "status-title"
  }, {
    "tabindex": "-1"
  }], [title], false), domView.element("p", [{
    "class": "status-description"
  }], [description], false), domView.element("div", [{
    "class": "status-actions"
  }], [domView.fragment([primary, secondary])], false), domView.element("div", [{
    "class": "status-help"
  }], [domView.element("strong", [], [service ? c.serviceHelp : session ? c.sessionHelp : c.help], false), domView.element("p", [], [service ? c.serviceHelpText : session ? c.sessionHelpText : c.helpText], false)], false), email ? domView.element("p", [{
    "class": "status-account"
  }], [domView.fragment([c.account, " ", email])], false) : ''], false)], false), domView.element("footer", [{
    "class": "status-footer"
  }], [domView.element("span", [], [c.footer], false), domView.element("span", [], ["Studiodeck"], false)], false)], false);
}
export function mountErrorPage(target, error, options = {}) {
  domView.mount(target, errorPage(error, options));
  document.title = domView.concat(target.querySelector('h1')?.textContent || 'Studiodeck', ' · Studiodeck');
  target.querySelector('[data-error-retry]')?.addEventListener('click', options.onRetry || (() => location.reload()));
  target.querySelector('h1')?.focus({
    preventScroll: true
  });
}
