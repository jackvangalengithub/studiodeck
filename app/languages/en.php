<?php
// Client-facing budget assistant and sign-in copy.
return json_decode(<<<'JSON'
{
  "no_legal": "No matching legal text was found. This does not establish whether the work is included or excluded.",
  "review_legal": "Review these source excerpts; the offline helper cannot determine contractual inclusion:\n\n",
  "partial": "These are selected excerpts, not a review of the entire document. ",
  "warnings": "Some document text is unavailable or needs review. ",
  "unknown": "These costs are still unspecified: {items}. They are not included in the known total.",
  "no_unknown": "There are no separately recorded unspecified costs. This does not guarantee that every project cost has been included.",
  "included": "Included subquotes are already covered by their parent quote and are not added again: {items}.",
  "no_included": "There are no recorded included subquotes in this iteration.",
  "total": "The recorded total is €{amount}. {count} cost item(s) remain unspecified and are excluded. Included subquotes are counted within their parent quote. VAT treatment follows each source; check the source notes.",
  "help": "I can show the recorded total, unspecified costs, and included subquotes. Free-form AI budget questions become available when your studio connects its AI service.",
  "page": "page",
  "no_answer": "No answer was returned.",
  "login_title": "Sign in · Studiodeck",
  "login_welcome": "Welcome to Studiodeck.",
  "login_intro": "Start your 7-day trial, or sign in to your studios and shared projects. No card required.",
  "login_email": "Your email address",
  "login_submit": "Email me a sign-in link",
  "login_continue": "Continue",
  "login_signing_in": "Signing you in…",
  "login_note": "Sign-in links work once and expire after 15 minutes. Your session lasts 14 days.",
  "login_request": "Request a new sign-in link",
  "login_language": "Language",
  "login_legacy": "Please sign in with the email address that received the invitation to open your shared projects.",
  "login_failed": "Sign-in could not be completed.",
  "login_restricted": "If this address has access, a sign-in link will arrive shortly.",
  "login_sent": "Check your email for your sign-in link.",
  "login_local": "Local development: the sign-in link is in storage/mail.log.",
  "login_expired": "This sign-in link is expired or has already been used.",
  "login_invalid_email": "Please enter a valid email address.",
  "login_rate_limit": "Please wait a little before trying again."
}
JSON, true);
