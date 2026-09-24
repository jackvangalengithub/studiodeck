# Scrolling presentations

Open a presentation, reveal the navigation sidebar and choose **Scroll** beside **Slides**. The same presentation becomes a single page with chapter navigation, large images and readable project sections. On phones, choose a chapter from the header menu. Use **Slides** in the page header to return to the item currently in view.

Both modes use the existing presentation order, chapter names, content, theme and iteration. Hidden and deleted slides are excluded from the scrolling page. No separate page authoring or website publication is needed; existing presentation access rules apply.

Each section has its own comments and source-file actions. Image pins remain attached to their original slide and image version. Image zoom, comparisons, floorplan controls, budget interactions, questions, videos and downloads use the existing components. Studio users can edit a section from its footer.

Copying a presentation URL in Scroll mode retains `view=scroll` and the current slide for signed-in studio and client routes. Reloading restores that section. Switching modes preserves the current item, and updates within the reading view preserve its scroll position. Ordinary scrolling replaces the current history entry rather than adding one for every section.

The page uses native document scrolling and respects reduced-motion preferences. Authenticated image previews load as they approach the viewport; image frames reserve space before loading. Videos remain click-to-play. Repeated system sections receive distinct DOM IDs.

Implementation: `public/assets/presentation-scroll.js` provides the reading layout and navigation, and `presentation-scroll.css` provides its responsive styling. `app.js` supplies the shared slide content and actions. Annotation controllers are scoped to individual content sections in both modes. The frozen `/mock` snapshot is unchanged.

Checks:

```sh
node tests/test_presentation_scroll.mjs
node tests/test_routes.mjs
node tests/test_annotations.mjs
node scripts/preview.mjs
# In another terminal, with Playwright and Chromium available:
node tests/test_presentation_scroll.cjs
node tests/test_presentation_sidebar.cjs
```

Browser tests accept `STUDIODECK_TEST_URL`, `PLAYWRIGHT_MODULE` and `CHROMIUM_EXECUTABLE`. The scrolling test uses isolated API fixtures and does not modify stored projects or contact clients.
