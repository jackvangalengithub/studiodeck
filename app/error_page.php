<?php
declare(strict_types=1);

// A self-contained document: error pages must still work without a session, JS,
// a database connection, or permission to fetch the application's assets.
function render_error_page(int $status, string $message='', array $options=[]): void {
    $nl=($options['language']??'en')==='nl';
    $c=$nl?[
        'edition'=>'Ruimte voor goed ontwerp','footer'=>'Jouw ontwerp, prachtig samengebracht.','label'=>'Een andere weg vooruit',
        'missing'=>'Deze ruimte is niet beschikbaar.','access'=>'We helpen je op weg.','session'=>'Meld je opnieuw aan.','service'=>'Even pauze. We zijn zo terug.','invalid'=>'Controleer deze link nog even.',
        'description'=>'We konden deze pagina niet openen. De link is mogelijk gewijzigd, of dit account heeft geen toegang meer.',
        'serviceDescription'=>'We kunnen deze pagina op dit moment niet openen. Probeer het over een ogenblik opnieuw.',
        'sessionDescription'=>'Meld je opnieuw aan om verder te gaan naar je projecten en gesprekken.',
        'choose'=>'Je werkruimtes en projecten','signin'=>'Inloggen','another'=>'Ander e-mailadres gebruiken','retry'=>'Opnieuw proberen','account'=>'Ingelogd als',
        'help'=>'Had je hier je project verwacht?','helpText'=>'Controleer of je het e-mailadres gebruikt waarop je studio je heeft uitgenodigd. Je kunt je studio ook om een nieuwe uitnodiging vragen.',
        'serviceHelp'=>'Even opnieuw verbinden','serviceHelpText'=>'Controleer je verbinding en probeer het opnieuw. Blijft het probleem bestaan? Kom dan later terug.',
        'sessionHelp'=>'Het juiste e-mailadres geeft toegang','sessionHelpText'=>'Gebruik het e-mailadres waarop je de projectuitnodiging hebt ontvangen.',
        'website'=>'Deze website is niet beschikbaar.','websiteDescription'=>'Deze website is momenteel niet beschikbaar. Controleer het adres of kom later terug.',
        'websiteHelp'=>'Op zoek naar de studio?','websiteHelpText'=>'Neem rechtstreeks contact op met de studio om hun website te vinden.','home'=>'Terug naar de website',
    ]:[
        'edition'=>'A considered space','footer'=>'Your design, beautifully together.','label'=>'A different way forward',
        'missing'=>'This space isn’t available.','access'=>'Let’s find your space.','session'=>'Let’s get you signed in.','service'=>'A little pause. We’ll be back.','invalid'=>'This link needs another look.',
        'description'=>'We couldn’t open this page. The link may have changed, or this account may no longer have access.',
        'serviceDescription'=>'We’re having trouble opening this page right now. Please try again in a moment.',
        'sessionDescription'=>'Sign in again to continue to your projects and conversations.',
        'choose'=>'Your workspaces & projects','signin'=>'Sign in','another'=>'Use another email','retry'=>'Try again','account'=>'Signed in as',
        'help'=>'Expecting to find your project here?','helpText'=>'Check that you’re using the email address your studio invited. You can also ask your studio for a new invitation.',
        'serviceHelp'=>'A moment to reconnect','serviceHelpText'=>'Check your connection, then try again. If this continues, please come back a little later.',
        'sessionHelp'=>'The right email opens the right doors','sessionHelpText'=>'Use the email address that received your project invitation.',
        'website'=>'This website isn’t available.','websiteDescription'=>'This space is currently unavailable. Please check the address or come back a little later.',
        'websiteHelp'=>'Looking for the studio?','websiteHelpText'=>'You can contact the studio directly for help finding their website.','home'=>'Back to the website',
    ];
    $kind=$options['kind']??($status>=500?'service':match($status){401=>'session',403=>'access',400=>'invalid',default=>'missing'});
    $signedIn=!empty($options['signed_in']);$email=$options['email']??'';
    $escape=fn($value)=>htmlspecialchars((string)$value,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');
    $title=$c[$kind]??$c['missing'];
    $description=in_array($kind,['service','session','website'],true)?$c[$kind.'Description']:($message?:$c['description']);
    $help=in_array($kind,['service','session','website'],true)?$kind.'Help':'help';
    $home=$kind==='website'?($options['home']??'/'):($signedIn?'/choose':'/login');
    // Links are local paths only; never reflect a supplied URL or credential.
    if(!preg_match('~^/(?!/)~',$home)||preg_match('/[\\\\\r\n]/',$home))$home='/';
    $retry=in_array($kind,['service','website'],true);
    $primary=$retry?'':($kind==='session'?'/login':$home);
    $primaryLabel=$retry?$c['retry']:($kind==='session'||!$signedIn?$c['signin']:$c['choose']);
    $secondary=$retry?$home:($signedIn&&$kind!=='session'?'/login?returnTo=%2Fchoose':'');
    $secondaryLabel=$retry?($kind==='website'?$c['home']:($signedIn?$c['choose']:$c['signin'])):$c['another'];
    $css=file_get_contents(__DIR__.'/../public/auth/error-page.css');
    http_response_code($status);
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-store');header('X-Robots-Tag: noindex');
    header('Content-Security-Policy: default-src \'none\'; style-src \'sha256-'.base64_encode(hash('sha256',$css,true)).'\'; base-uri \'none\'; frame-ancestors \'none\'; form-action \'none\'');
    ?>
<!doctype html>
<html lang="<?= $nl?'nl':'en' ?>"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title><?= $escape($title) ?> · Studiodeck</title><style><?= $css ?></style></head>
<body><main class="status-page" id="main">
<header class="status-header"><a class="status-brand" href="<?= $escape($home) ?>">studio<strong>deck</strong><sup>®</sup></a><span class="status-edition"><?= $escape($c['edition']) ?></span></header>
<div class="status-layout">
<section class="status-content" aria-labelledby="status-title"><p class="status-eyebrow"><?= $escape($c['label']) ?></p><h1 id="status-title" tabindex="-1"><?= $escape($title) ?></h1><p class="status-description"><?= $escape($description) ?></p>
<div class="status-actions"><a class="status-button" href="<?= $escape($primary) ?>"><?= $escape($primaryLabel) ?> <span aria-hidden="true"><?= $retry?'↻':'→' ?></span></a><?php if($secondary!==''): ?><a class="status-button status-button-secondary" href="<?= $escape($secondary) ?>"><?= $escape($secondaryLabel) ?></a><?php endif; ?></div>
<div class="status-help"><strong><?= $escape($c[$help]) ?></strong><p><?= $escape($c[$help.'Text']) ?></p></div>
<?php if($email!==''): ?><p class="status-account"><?= $escape($c['account']) ?> <?= $escape($email) ?></p><?php endif; ?></section></div>
<footer class="status-footer"><span><?= $escape($c['footer']) ?></span><span>Studiodeck</span></footer>
</main></body></html>
<?php
}
