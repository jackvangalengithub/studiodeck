<?php
// Client-facing budget assistant and sign-in copy.
return json_decode(<<<'JSON'
{
  "no_legal": "Er is geen overeenkomende tekst over de voorwaarden gevonden. Hieruit blijkt niet of het werk wel of niet is inbegrepen.",
  "review_legal": "Bekijk deze bronfragmenten; de offlinehulp kan niet bepalen wat contractueel is inbegrepen:\n\n",
  "partial": "Dit zijn geselecteerde fragmenten, geen beoordeling van het volledige document. ",
  "warnings": "Sommige documenttekst is niet beschikbaar of moet worden gecontroleerd. ",
  "unknown": "Deze kosten zijn nog niet bepaald: {items}. Ze tellen niet mee in het bekende totaal.",
  "no_unknown": "Er zijn geen afzonderlijke onbepaalde kosten vastgelegd. Dit garandeert niet dat alle projectkosten zijn opgenomen.",
  "included": "Inbegrepen deeloffertes zijn al opgenomen in de hoofdofferte en worden niet opnieuw opgeteld: {items}.",
  "no_included": "In deze versie zijn geen inbegrepen deeloffertes vastgelegd.",
  "total": "Het vastgelegde totaal is €{amount}. {count} kostenpost(en) zijn nog niet bepaald en tellen niet mee. Inbegrepen deeloffertes worden meegeteld in de hoofdofferte. De btw-behandeling volgt de bron; controleer de opmerkingen bij de bron.",
  "help": "Ik kan het vastgelegde totaal, onbepaalde kosten en inbegrepen deeloffertes tonen. Vrije budgetvragen aan AI zijn beschikbaar zodra je studio de AI-dienst aansluit.",
  "page": "pagina",
  "no_answer": "Er is geen antwoord ontvangen.",
  "login_title": "Inloggen · Studiodeck",
  "login_welcome": "Welkom bij Studiodeck.",
  "login_intro": "Start je proefperiode van 7 dagen of log in bij je studio’s en gedeelde projecten. Geen creditcard nodig.",
  "login_email": "Je e-mailadres",
  "login_submit": "Stuur me een inloglink",
  "login_continue": "Doorgaan",
  "login_signing_in": "Je wordt ingelogd…",
  "login_note": "Inloglinks werken eenmalig en verlopen na 15 minuten. Je blijft 14 dagen ingelogd.",
  "login_request": "Een nieuwe inloglink aanvragen",
  "login_language": "Taal",
  "login_legacy": "Log in met het e-mailadres waarop je de uitnodiging hebt ontvangen om je gedeelde projecten te openen.",
  "login_failed": "Inloggen is niet gelukt.",
  "login_restricted": "Als dit adres toegang heeft, ontvang je binnenkort een inloglink.",
  "login_sent": "Kijk in je e-mail voor de inloglink.",
  "login_local": "Lokale ontwikkeling: de inloglink staat in storage/mail.log.",
  "login_expired": "Deze inloglink is verlopen of al gebruikt.",
  "login_invalid_email": "Vul een geldig e-mailadres in.",
  "login_rate_limit": "Wacht even voordat je het opnieuw probeert."
}
JSON, true);
