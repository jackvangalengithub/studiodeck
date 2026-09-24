# Project consistency checks

The designer's **Inconsistency suggestions** panel in Communication compares written requirements and visual observations within the current iteration. It flags possible differences in colour, material, finish, product/model and explicitly written dimensions, prices, scope and inclusions. It never measures dimensions from pixels or automatically corrects a source.

Each finding shows both sources, their roles, the object/property, and either an exact text quotation or an image region. **View evidence** opens the page/image with the relevant region highlighted. Designers can resolve, dismiss or reopen findings and choose **Discuss** to start one private conversation containing both source descriptions and text quotations. Repeated clicks open that same subject.

## Source importance

AI classifies pages and individual extracted images as inspiration, concept, unselected alternative, detailed design, specification, approved specification, before, progress, completed or unknown. A detailed document can contain an inspiration image; evidence retains its own role. Approved status requires quoted approval evidence or an explicit designer correction; visual polish never establishes approval.

In **Files → Source roles**, designers can correct the whole document or a particular page/image. A document-wide specification role does not promote reference images, alternatives or before photos. Individual page/image overrides take precedence. Existing before/reference situation labels suppress irrelevant comparisons.

At least one side must be a detailed design or specification, and at least one must be written evidence. Inspiration, before photos and unselected alternatives are excluded. Specifications express intent; completed/progress photos express observed reality. Generated image variations are design evidence, not proof of installation. Room, object part, identifiers, lighting and design stage are checked again before presenting a finding. Uncertain object matches and unverifiable comparisons do not become suggestions. Missing prices, missing information, preferences and generic next steps do not become suggestions either; zero findings is a valid result. Price comparisons require comparable scope, quantity, currency, units, VAT treatment and quote revision.

## Processing and coverage

With AI connected, the worker queues checks after uploads/image edits finish, source roles or slide labels change, selected image versions change, and new iterations are created. **Suggest items** opens an explanatory splash first. Only **Compare files** starts the manual run. Results are designer-only; starting a discussion does not publish or send it.

Source extraction is cached by content/version and labels. Candidate differences receive a second model review with the actual image(s) and source text. Code validates source references, verbatim quotes and image-region coordinates. PDF specification pages without stored previews are rendered on demand using the existing PyMuPDF dependency and cached separately from document extraction. Standalone images without extracted text use cached Tesseract OCR to make written annotations available as quoted evidence.

A run currently covers up to 60 pages/images, 18,000 text bytes per source, 20 facts per source, 240 comparison facts and 30 suspected pairs. The panel reports limits, extraction problems and verification failures. No findings does not certify a project as correct. AI accuracy, especially object matching and colour under unusual lighting, still needs evaluation on representative project files.

Checks use the configured text/vision model and API key, with no additional service required. Repeated unchanged-source runs reuse extraction; comparison and verification still make model requests. Trial projects have an allowance of 30 check runs. Without an AI connection, source roles remain editable and the panel explains why checks are unavailable.

Changes to sources, labels, roles or selected image versions mark results outdated. Results are saved only if the iteration still matches the input snapshot and is unlocked. Reviewed decisions survive reruns over the same evidence. A pending follow-up run can wait behind a running check when inputs change. New iterations copy source roles and extraction caches, then run fresh comparisons.

Restart the background worker after installing this change so its long-running PHP process loads the new job handler. Schema additions are automatic on the next database connection.

## Validation

`tests/test_consistency.py` exercises real database/API behavior with mocked model responses, including within-page and cross-document differences, role suppression, ungrounded evidence, uncertain comparisons, stale results, review/Checklist privacy, authorization, queueing, PDF previews and deletion. It needs the same PHP/Python dependencies as the application and makes no paid API calls.

`tests/test_consistency_browser.cjs` uses an exported fixture (`CONSISTENCY_BROWSER_EXPORT`) to check Communication suggestions, the explanation before starting, image regions, review actions, role corrections and reruns in Chromium. The feature also participates in the existing API security inventory and Checklist regressions.
