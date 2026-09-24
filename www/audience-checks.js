'use strict';

// Fictional evidence examples for each studio discipline. Source excerpts are
// plain text split around the highlighted difference, never executable HTML.
const audienceChecks = {
  "interior": {
    "project": "interior project",
    "files": "room plans, finish schedules and supplier quotes",
    "signals": "A different tap finish. A conflicting cabinet width. Fitting left out of a quote.",
    "pin": "Pin feedback to the exact finish, furniture detail or point on a room plan.",
    "task": "Order the bathroom finish samples",
    "done": "Confirm the kitchen measurements",
    "followup": "Check the tap finish",
    "question": "Clarify whether curtain fitting is included",
    "cost": "The revised curtain quote adds €800 for fitting.",
    "examples": [
      {
        "category": "MATERIAL & FINISH",
        "title": "The same tap. Two different finishes.",
        "sources": [
          {
            "role": "DESIGN SPECIFICATION",
            "file": "Bathroom finishes.pdf · p. 4",
            "before": "Basin tap B-02: ",
            "value": "brushed brass",
            "after": " finish."
          },
          {
            "role": "SUPPLIER QUOTE",
            "file": "Bathroom quote.pdf · p. 2",
            "before": "Basin tap B-02: ",
            "value": "polished chrome",
            "after": " finish."
          }
        ],
        "reason": "Both documents name tap B-02, but specify different finishes. Check which finish the supplier should quote.",
        "discussion": "Is brushed brass still the intended finish? Let’s confirm before ordering."
      },
      {
        "category": "WRITTEN DIMENSIONS",
        "title": "One island. Two different widths.",
        "sources": [
          {
            "role": "DETAILED DRAWING",
            "file": "Kitchen elevation.pdf · p. 3",
            "before": "island cabinet K-01 — overall width: ",
            "value": "2400 mm",
            "after": "."
          },
          {
            "role": "SPECIFICATION",
            "file": "Joinery schedule.pdf · p. 6",
            "before": "island cabinet K-01 — overall width: ",
            "value": "2200 mm",
            "after": "."
          }
        ],
        "reason": "The written overall widths for island cabinet K-01 differ. AI compares the annotations; it doesn’t measure the drawing.",
        "discussion": "Which width should the joiner use? Let’s align the drawing and schedule."
      },
      {
        "category": "SCOPE & INCLUSIONS",
        "title": "Curtain fitting included. Or excluded?",
        "sources": [
          {
            "role": "PROJECT SPECIFICATION",
            "file": "Window treatments.pdf · p. 2",
            "before": "curtain package C-01: ",
            "value": "fitting included",
            "after": "."
          },
          {
            "role": "SUPPLIER QUOTE",
            "file": "Curtain quote.pdf · p. 1",
            "before": "curtain package C-01: ",
            "value": "fitting excluded",
            "after": "."
          }
        ],
        "reason": "The quote excludes fitting that the specification includes for curtain package C-01. Clarify the scope before asking the client to decide.",
        "discussion": "Can we get a quote including fitting, so the client has the complete scope?"
      }
    ]
  },
  "landscape": {
    "project": "garden project",
    "files": "planting plans, paving specifications and landscaping quotes",
    "signals": "A different paving material. A conflicting path width. Irrigation left out of a quote.",
    "pin": "Pin feedback to a planting bed, paving detail or point on the garden plan.",
    "task": "Order the terrace paving samples",
    "done": "Confirm the garden path measurements",
    "followup": "Check the terrace paving material",
    "question": "Clarify whether irrigation is included",
    "cost": "The revised landscaping quote adds €800 for irrigation.",
    "examples": [
      {
        "category": "MATERIAL",
        "title": "One terrace. Two paving materials.",
        "sources": [
          {
            "role": "PAVING SPECIFICATION",
            "file": "Terrace specification.pdf · p. 2",
            "before": "Terrace T-01 paving: ",
            "value": "natural limestone",
            "after": "."
          },
          {
            "role": "CONTRACTOR QUOTE",
            "file": "Landscaping quote.pdf · p. 3",
            "before": "Terrace T-01 paving: ",
            "value": "porcelain tiles",
            "after": "."
          }
        ],
        "reason": "The same terrace is specified in limestone and quoted in porcelain. Confirm the intended paving material.",
        "discussion": "Should T-01 stay natural limestone? Let’s align the paving quote before ordering."
      },
      {
        "category": "WRITTEN DIMENSIONS",
        "title": "A garden path with two written widths.",
        "sources": [
          {
            "role": "DETAILED DRAWING",
            "file": "Garden layout.pdf · p. 2",
            "before": "garden path P-02 — overall width: ",
            "value": "1200 mm",
            "after": "."
          },
          {
            "role": "SPECIFICATION",
            "file": "Hardscape schedule.pdf · p. 4",
            "before": "garden path P-02 — overall width: ",
            "value": "900 mm",
            "after": "."
          }
        ],
        "reason": "The written overall widths for garden path P-02 differ. AI compares the annotations; it doesn’t measure the drawing.",
        "discussion": "Which path width should the landscaper use? Let’s align the layout and schedule."
      },
      {
        "category": "SCOPE & INCLUSIONS",
        "title": "Irrigation included. Or excluded?",
        "sources": [
          {
            "role": "PROJECT SPECIFICATION",
            "file": "Planting specification.pdf · p. 3",
            "before": "planting package PL-01: ",
            "value": "drip irrigation included",
            "after": "."
          },
          {
            "role": "SUPPLIER QUOTE",
            "file": "Landscaping quote.pdf · p. 4",
            "before": "planting package PL-01: ",
            "value": "drip irrigation excluded",
            "after": "."
          }
        ],
        "reason": "The quote excludes drip irrigation that the specification includes for planting package PL-01. Clarify the scope before asking the client to decide.",
        "discussion": "Can the landscaper include drip irrigation in the quote before the client confirms?"
      }
    ]
  },
  "architecture": {
    "project": "building project",
    "files": "detailed drawings, building specifications and contractor quotes",
    "signals": "A different window finish. A conflicting opening width. Glazing installation left out of a quote.",
    "pin": "Pin feedback to the exact opening, facade detail or point on a floorplan.",
    "task": "Request the window frame finish samples",
    "done": "Confirm the garden opening measurements",
    "followup": "Check the window frame finish",
    "question": "Clarify whether glazing installation is included",
    "cost": "The revised glazing quote adds €800 for installation.",
    "examples": [
      {
        "category": "COLOUR & FINISH",
        "title": "The window frame changes colour in the quote.",
        "sources": [
          {
            "role": "WINDOW SPECIFICATION",
            "file": "Window schedule.pdf · p. 5",
            "before": "Window W-03 frame finish: ",
            "value": "RAL 7016 matt",
            "after": "."
          },
          {
            "role": "SUPPLIER QUOTE",
            "file": "Window quote.pdf · p. 2",
            "before": "Window W-03 frame finish: ",
            "value": "RAL 9005 matt",
            "after": "."
          }
        ],
        "reason": "The window schedule and supplier quote assign different RAL colours to frame W-03. Check the intended finish.",
        "discussion": "Can we confirm the RAL colour for W-03 before the supplier places the order?"
      },
      {
        "category": "WRITTEN DIMENSIONS",
        "title": "One opening. Two different widths.",
        "sources": [
          {
            "role": "DETAILED DRAWING",
            "file": "Garden elevation.pdf · p. 2",
            "before": "garden opening G-01 — overall width: ",
            "value": "3000 mm",
            "after": "."
          },
          {
            "role": "SPECIFICATION",
            "file": "Opening schedule.pdf · p. 3",
            "before": "garden opening G-01 — overall width: ",
            "value": "2800 mm",
            "after": "."
          }
        ],
        "reason": "The written overall widths for garden opening G-01 differ. AI compares the annotations; it doesn’t measure the drawing.",
        "discussion": "Which opening width should the team work to? Let’s align the drawing and schedule."
      },
      {
        "category": "SCOPE & INCLUSIONS",
        "title": "Glazing installation included. Or excluded?",
        "sources": [
          {
            "role": "PROJECT SPECIFICATION",
            "file": "Glazing specification.pdf · p. 4",
            "before": "glazing package G-01: ",
            "value": "installation included",
            "after": "."
          },
          {
            "role": "SUPPLIER QUOTE",
            "file": "Glazing quote.pdf · p. 2",
            "before": "glazing package G-01: ",
            "value": "installation excluded",
            "after": "."
          }
        ],
        "reason": "The quote excludes installation that the specification includes for glazing package G-01. Clarify the scope before asking the client to decide.",
        "discussion": "Can we get a glazing quote including installation before the client confirms the package?"
      }
    ]
  },
  "furniture": {
    "project": "furniture project",
    "files": "joinery drawings, material schedules and workshop quotes",
    "signals": "A different cabinet material. A conflicting island width. Fitting left out of a quote.",
    "pin": "Pin feedback to the exact joint, handle or detail on a cabinetry drawing.",
    "task": "Order the cabinet front samples",
    "done": "Confirm the island cabinet measurements",
    "followup": "Check the cabinet front material",
    "question": "Clarify whether cabinet fitting is included",
    "cost": "The revised cabinetry quote adds €800 for fitting.",
    "examples": [
      {
        "category": "MATERIAL",
        "title": "Solid oak specified. Oak veneer quoted.",
        "sources": [
          {
            "role": "MATERIAL SPECIFICATION",
            "file": "Cabinetry materials.pdf · p. 3",
            "before": "Cabinet fronts C-04: ",
            "value": "solid oak",
            "after": "."
          },
          {
            "role": "WORKSHOP QUOTE",
            "file": "Cabinetry quote.pdf · p. 2",
            "before": "Cabinet fronts C-04: ",
            "value": "oak veneer on MDF",
            "after": "."
          }
        ],
        "reason": "The material specification and workshop quote describe different constructions for the same cabinet fronts. Confirm which material is intended.",
        "discussion": "Are C-04 fronts intended to be solid oak? Let’s confirm the material and revised quote."
      },
      {
        "category": "WRITTEN DIMENSIONS",
        "title": "One island. Two different widths.",
        "sources": [
          {
            "role": "DETAILED DRAWING",
            "file": "Kitchen elevation.pdf · p. 3",
            "before": "island cabinet K-01 — overall width: ",
            "value": "2400 mm",
            "after": "."
          },
          {
            "role": "SPECIFICATION",
            "file": "Joinery schedule.pdf · p. 6",
            "before": "island cabinet K-01 — overall width: ",
            "value": "2200 mm",
            "after": "."
          }
        ],
        "reason": "The written overall widths for island cabinet K-01 differ. AI compares the annotations; it doesn’t measure the drawing.",
        "discussion": "Which width should the workshop use? Let’s align the drawing and schedule before production."
      },
      {
        "category": "SCOPE & INCLUSIONS",
        "title": "Cabinet fitting included. Or excluded?",
        "sources": [
          {
            "role": "PROJECT SPECIFICATION",
            "file": "Cabinetry specification.pdf · p. 4",
            "before": "cabinet package C-04: ",
            "value": "on-site fitting included",
            "after": "."
          },
          {
            "role": "SUPPLIER QUOTE",
            "file": "Workshop quote.pdf · p. 3",
            "before": "cabinet package C-04: ",
            "value": "on-site fitting excluded",
            "after": "."
          }
        ],
        "reason": "The quote excludes on-site fitting that the specification includes for cabinet package C-04. Clarify the scope before asking the client to decide.",
        "discussion": "Can the workshop include on-site fitting so the client can confirm the full package?"
      }
    ]
  },
  "events": {
    "project": "event project",
    "files": "exhibition layouts, production specifications and supplier proposals",
    "signals": "A different lighting model. A conflicting display width. Dismantling left out of a quote.",
    "pin": "Pin feedback to a display, lighting position or point on an exhibition layout.",
    "task": "Request a sample of the display finish",
    "done": "Confirm the display plinth measurements",
    "followup": "Check the lighting fixture model",
    "question": "Clarify whether dismantling is included",
    "cost": "The revised production quote adds €800 for dismantling.",
    "examples": [
      {
        "category": "PRODUCT MODEL",
        "title": "The lighting model changes in the proposal.",
        "sources": [
          {
            "role": "LIGHTING SPECIFICATION",
            "file": "Lighting schedule.pdf · p. 2",
            "before": "Fixture L-04 model: ",
            "value": "Beam 200",
            "after": "."
          },
          {
            "role": "SUPPLIER PROPOSAL",
            "file": "Lighting proposal.pdf · p. 3",
            "before": "Fixture L-04 model: ",
            "value": "Beam 100",
            "after": "."
          }
        ],
        "reason": "The lighting schedule and supplier proposal name different models for fixture L-04. Confirm whether the substitution is intended.",
        "discussion": "Is the Beam 100 an intended substitution? Let’s confirm the fixture before the supplier books it."
      },
      {
        "category": "WRITTEN DIMENSIONS",
        "title": "One display plinth. Two different widths.",
        "sources": [
          {
            "role": "DETAILED DRAWING",
            "file": "Exhibition layout.pdf · p. 3",
            "before": "display plinth D-02 — overall width: ",
            "value": "1800 mm",
            "after": "."
          },
          {
            "role": "SPECIFICATION",
            "file": "Production schedule.pdf · p. 2",
            "before": "display plinth D-02 — overall width: ",
            "value": "1500 mm",
            "after": "."
          }
        ],
        "reason": "The written overall widths for display plinth D-02 differ. AI compares the annotations; it doesn’t measure the drawing.",
        "discussion": "Which width should the fabricator use for D-02? Let’s align the layout and production schedule."
      },
      {
        "category": "SCOPE & INCLUSIONS",
        "title": "Dismantling included. Or excluded?",
        "sources": [
          {
            "role": "PROJECT SPECIFICATION",
            "file": "Production specification.pdf · p. 5",
            "before": "exhibition package E-01: ",
            "value": "post-event dismantling included",
            "after": "."
          },
          {
            "role": "SUPPLIER QUOTE",
            "file": "Production quote.pdf · p. 3",
            "before": "exhibition package E-01: ",
            "value": "post-event dismantling excluded",
            "after": "."
          }
        ],
        "reason": "The quote excludes post-event dismantling that the specification includes for exhibition package E-01. Clarify the scope before asking the client to decide.",
        "discussion": "Can the supplier include post-event dismantling before we ask the client to confirm?"
      }
    ]
  },
  "signmaker": {
    "project": "signage project",
    "files": "lettering drawings, vinyl specifications and production quotes",
    "signals": "A different vinyl finish. A conflicting sign width. Installation left out of a quote.",
    "pin": "Pin feedback to the exact letter, vinyl detail or point on a storefront mockup.",
    "task": "Order the storefront vinyl samples",
    "done": "Confirm the fascia sign measurements",
    "followup": "Check the storefront vinyl finish",
    "question": "Clarify whether sign installation is included",
    "cost": "The revised signage quote adds €800 for installation.",
    "examples": [
      {
        "category": "MATERIAL & FINISH",
        "title": "The same window lettering. Two vinyl finishes.",
        "sources": [
          {
            "role": "VINYL SPECIFICATION",
            "file": "Window lettering.pdf · p. 2",
            "before": "Window lettering V-02: ",
            "value": "matt black",
            "after": " vinyl."
          },
          {
            "role": "PRODUCTION QUOTE",
            "file": "Vinyl quote.pdf · p. 1",
            "before": "Window lettering V-02: ",
            "value": "gloss black",
            "after": " vinyl."
          }
        ],
        "reason": "The specification and quote name different vinyl finishes for the same window lettering. Confirm the finish before production.",
        "discussion": "Should V-02 use matt black vinyl? Let’s confirm before cutting the lettering."
      },
      {
        "category": "WRITTEN DIMENSIONS",
        "title": "One fascia sign. Two different widths.",
        "sources": [
          {
            "role": "DETAILED DRAWING",
            "file": "Storefront elevation.pdf · p. 2",
            "before": "fascia sign S-01 — overall width: ",
            "value": "3000 mm",
            "after": "."
          },
          {
            "role": "SPECIFICATION",
            "file": "Sign production schedule.pdf · p. 1",
            "before": "fascia sign S-01 — overall width: ",
            "value": "2800 mm",
            "after": "."
          }
        ],
        "reason": "The written overall widths for fascia sign S-01 differ. AI compares the annotations; it doesn’t measure the drawing.",
        "discussion": "Which width should production use for S-01? Let’s align the elevation and schedule."
      },
      {
        "category": "SCOPE & INCLUSIONS",
        "title": "Sign installation included. Or excluded?",
        "sources": [
          {
            "role": "PROJECT SPECIFICATION",
            "file": "Signage specification.pdf · p. 5",
            "before": "storefront lettering S-01: ",
            "value": "installation included",
            "after": "."
          },
          {
            "role": "SUPPLIER QUOTE",
            "file": "Signage quote.pdf · p. 2",
            "before": "storefront lettering S-01: ",
            "value": "installation excluded",
            "after": "."
          }
        ],
        "reason": "The quote excludes installation that the specification includes for storefront lettering S-01. Clarify the scope before asking the client to decide.",
        "discussion": "Can we get a quote including installation, so the client has the complete scope?"
      }
    ]
  }
};

function updateAudienceChecks(id, profile, story) {
  const checks=audienceChecks[id];
  if(!checks)return;
  const text=(selector,value)=>document.querySelectorAll(selector).forEach(el=>el.textContent=value);
  text('.hero-connected',`An extra pair of eyes on your ${checks.project}. AI automatically checks your ${checks.files} for conflicting details and brings possible issues to you, so you can focus on the design.`);
  const heading=document.querySelector('#ai-checks-title');
  const emphasis=document.createElement('em');emphasis.textContent='AI checks the details.';
  heading.replaceChildren(document.createTextNode(story.title),document.createElement('br'),emphasis);
  text('.ai-checks-heading>p',`Upload your ${checks.files} and let AI take a second look. Studiodeck automatically compares documents and images in the background, looking for details that don’t agree. ${checks.signals} It brings possible issues and their sources to your attention, helping you spot things you might otherwise miss.`);
  text('.ai-example-intro',`The kind of detail AI can find for your ${checks.project} automatically. Explore three examples below.`);
  document.querySelector('.ai-evidence-demo').setAttribute('aria-label',`Illustrative AI discrepancy examples for ${profile.label.toLowerCase()}`);
  document.querySelectorAll('.ai-finding').forEach((finding,index)=>{
    const example=checks.examples[index];
    finding.querySelector('summary small').textContent=example.category;
    finding.querySelector('summary strong').textContent=example.title;
    finding.querySelectorAll('.ai-source-pair figure').forEach((figure,sourceIndex)=>{
      const source=example.sources[sourceIndex];
      const role=document.createElement('span');role.textContent=source.role;
      figure.querySelector('figcaption').replaceChildren(role,document.createTextNode(source.file));
      const mark=document.createElement('mark');mark.textContent=source.value;
      figure.querySelector('blockquote').replaceChildren(document.createTextNode('“'+source.before),mark,document.createTextNode(source.after+'”'));
    });
    const reason=document.createElement('strong');reason.textContent='AI spotted a possible mismatch';
    finding.querySelector('.ai-finding-reason').replaceChildren(reason,document.createTextNode(' '+example.reason));
    const label=document.createElement('span');label.textContent='THE CONVERSATION IT COULD START';
    finding.querySelector('.ai-discuss-example').replaceChildren(label,document.createTextNode('“'+example.discussion+'”'));
  });
  text('.communication-story .check-list li:first-child',checks.pin);
  text('.checklist-story .product-story-copy>p:nth-of-type(2)',`A question about the quote. ${checks.task}. A client choice buried in feedback. When the next steps are scattered across files and conversations, you become the person who has to remember them all.`);
  text('.checklist-example-row:nth-child(1) h3',checks.task);
  text('.checklist-example-row:nth-child(2) h3',checks.question);
  text('.checklist-example-row:nth-child(2) p',checks.cost);
  text('.checklist-example-row:nth-child(3) h3',checks.done);
  text('.checklist-example-suggestion h3',checks.followup);
  text('.checklist-example-suggestion p',checks.examples[0].reason+' Review both sources before following up.');
  text('#ai-checks-faq-example',checks.examples[0].reason);
}
