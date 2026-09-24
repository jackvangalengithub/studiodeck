'use strict';

// Labels, descriptions and image files match public/assets/studio-types.json.
// Keep this static copy with www so the marketing site can be hosted independently.
const audiences = {
  "interior": {
    "label": "Interior design",
    "description": "Rooms, materials & ways of living",
    "headline": "Spaces made for living.",
    "intro": "Thoughtful interiors, natural materials, and details that make a place your own.",
    "alt": "A warm living room with natural materials and sculptural furniture",
    "projectTitle": "A considered home",
    "projectIntro": "Light, texture and space, brought together around everyday life.",
    "welcomeIntro": "Bring your room concepts, material choices and client feedback together. Turn your design files into a presentation you’re proud to share.",
    "image": "assets/studio-types/interior.webp"
  },
  "landscape": {
    "label": "Garden & landscape design",
    "description": "Gardens, planting & outdoor spaces",
    "headline": "A little closer to nature.",
    "intro": "Gardens shaped around the seasons. Thoughtful planting, natural materials, and places to pause.",
    "alt": "A lush woodland garden with a reflecting pool and layered planting",
    "projectTitle": "The woodland garden",
    "projectIntro": "Layered planting and quiet paths create a place to enjoy through the seasons.",
    "welcomeIntro": "Bring your garden plans, planting ideas and client feedback together. Give every outdoor project a clear, beautiful presentation.",
    "image": "assets/studio-types/landscape.webp"
  },
  "architecture": {
    "label": "Architecture",
    "description": "Buildings, places & new perspectives",
    "headline": "Thoughtful places. Lasting possibilities.",
    "intro": "Architecture rooted in its surroundings, shaped by light, proportion, and the people who use it.",
    "alt": "A contemporary house with clean architectural lines opening onto its garden",
    "projectTitle": "A house in the landscape",
    "projectIntro": "An exploration of proportion, daylight and the relationship between building and landscape.",
    "welcomeIntro": "Bring your plans, renders and client decisions together. Present the story behind your design, from first concept to the next revision.",
    "image": "assets/studio-types/architecture.webp"
  },
  "furniture": {
    "label": "Furniture & cabinetry design",
    "description": "Bespoke pieces, kitchens & craftsmanship",
    "headline": "Made with purpose. Made for you.",
    "intro": "Bespoke furniture and cabinetry, with honest materials, careful proportions, and craftsmanship in every detail.",
    "alt": "Bespoke timber kitchen cabinetry with a sculptural island and carefully finished details",
    "projectTitle": "The crafted kitchen",
    "projectIntro": "Warm timber, considered storage and precise joinery, designed around daily rituals.",
    "welcomeIntro": "Bring your sketches, material samples and price options together. Help clients see the craftsmanship and choose the details.",
    "image": "assets/studio-types/furniture.webp"
  },
  "events": {
    "label": "Event & exhibition design",
    "description": "Experiences, installations & occasions",
    "headline": "Moments that become memories.",
    "intro": "Immersive events and exhibitions, bringing together atmosphere, materials, and a story worth sharing.",
    "alt": "An atmospheric exhibition with suspended fabric, sculptural plinths and warm lighting",
    "projectTitle": "A gathering of ideas",
    "projectIntro": "An immersive installation that brings people, objects and stories together.",
    "welcomeIntro": "Bring your concepts, installations and supplier proposals together. Help clients picture the experience and decide with confidence.",
    "image": "assets/studio-types/events.webp"
  },
  "signmaker": {
    "label": "Sign maker",
    "description": "Storefront lettering, signs & vehicle graphics",
    "headline": "Make your business stand out.",
    "intro": "Storefront lettering, signs and vehicle graphics, made with precise finishes and a clear sense of identity.",
    "alt": "Raised storefront lettering above a shop window with a vinyl-wrapped van parked outside",
    "projectTitle": "A brand on the street",
    "projectIntro": "Dimensional letters, window graphics and a matching vehicle wrap bring one identity to every surface.",
    "welcomeIntro": "Bring your sign designs, storefront mockups, vehicle graphics and quotes together. Help clients choose materials and confirm the design before production.",
    "image": "assets/studio-types/signmaker.webp"
  }
};
const audienceStories = {
  signmaker: {
    "title": "You make brands visible.",
    "intro": "Bring your storefront mockups, lettering designs, vehicle graphics and quotes. AI brings them together in a client presentation, so every material, finish and installation detail is clear before production.",
    "conversation": "Keep lettering sizes, vinyl choices and artwork revisions with the project. Attach the updated design and quote, then ask the client to confirm before you start making or installing.",
    "question": "Could we add matching graphics to our van and see the updated quote?",
    "reply": "Here’s the vehicle mockup and revised quote, including the vinyl and installation.",
    "item": "Matching vehicle graphics",
    "attachment": "Vehicle graphics · revised quote.pdf",
    "approval": "ARTWORK & BUDGET CHANGE",
    "budget": [
        "Signs & lettering",
        "Vinyl & installation"
    ],
    "comment": "The storefront looks great. Could we see the same design on our van?",
    "portfolio": "Show your next client what their business could look like. Build showcases from selected storefront signs, window lettering and vehicle wraps, with the project photographs and client stories you choose to share.",
    "detail": "Lettering & vinyl finishes"
  },
  interior: {
    title:'You design the space.',
    intro:'Bring your room concepts, material palettes, renders and supplier quotes. AI brings them together in a client presentation, with budgets and answers alongside your vision.',
    conversation:'Keep questions about layouts, finishes and furniture with the project. Attach the revised quote and ask your client to confirm the details before you move ahead.',
    question:'We love the warmer oak. Could you send us the updated quote before we decide?',
    reply:'Of course. Here’s the revised finish and quote, with the difference shown below.',
    item:'Warm oak joinery',attachment:'Oak joinery · revised quote.pdf',approval:'FINISH & BUDGET CHANGE',
    budget:['Furniture & lighting','Materials & finishes'],comment:'Love this direction. Could we explore a warmer finish for the table?',
    portfolio:'Turn your completed interiors into a portfolio that feels like your studio. Select the rooms, photographs and client stories you want to share; your project showcases take shape from that reviewed content.',
    detail:'Materials & details'
  },
  landscape: {
    title:'You shape the garden.',
    intro:'Bring your garden plans, planting palettes, outdoor renders and landscaping quotes. AI builds a presentation that helps clients picture the seasons, explore the budget and see your vision take root.',
    conversation:'Keep planting choices, paving options and client decisions with the garden project. Attach the landscape quote and confirm a change before it becomes part of the budget.',
    question:'We love the layered planting. Could you include the larger trees in the revised quote?',
    reply:'Here’s the updated planting proposal, with the additional cost for the larger trees.',
    item:'Larger specimen trees',attachment:'Planting proposal · revised quote.pdf',approval:'PLANTING & BUDGET CHANGE',
    budget:['Planting & trees','Paving & garden materials'],comment:'Love the planting. Could we explore more shade beside the terrace?',
    portfolio:'Let your gardens bring in the next commission. Select your planting stories, outdoor photographs and client testimonials; your portfolio showcases come together from the projects you’ve chosen to share.',
    detail:'Planting & outdoor details'
  },
  architecture: {
    title:'You imagine the building.',
    intro:'Bring your plans, sections, renders and cost estimates. AI assembles the story behind the building, so clients can explore your design, understand the numbers and discuss the next revision.',
    conversation:'Keep questions about plans, materials and revisions beside the design. Share the updated drawing, attach the estimate and record your client’s confirmation in the project conversation.',
    question:'The wider garden opening feels right. Could we see the updated glazing estimate?',
    reply:'Here’s the revised drawing and glazing quote, with the budget difference highlighted.',
    item:'Wider garden glazing',attachment:'Garden elevation · glazing quote.pdf',approval:'DESIGN & BUDGET CHANGE',
    budget:['Structure & glazing','Materials & finishes'],comment:'The connection to the garden is lovely. Could we review the glazing options?',
    portfolio:'Give your architecture a place to be discovered. Build project showcases from selected drawings, renders, photographs and client stories, with room to explain the thinking behind each building.',
    detail:'Proportion & material'
  },
  furniture: {
    title:'You craft the details.',
    intro:'Bring your sketches, cabinetry drawings, finish samples and price options. AI turns them into a presentation that helps clients understand the craftsmanship and choose every detail with confidence.',
    conversation:'Keep dimensions, finish choices and price options with the piece you’re making. Attach the revised drawing and quote, then ask the client to confirm before the next step.',
    question:'We’d like the solid oak fronts. Could you confirm the difference in price?',
    reply:'Here’s the updated cabinetry quote with solid oak fronts and the price change.',
    item:'Solid oak cabinet fronts',attachment:'Cabinetry · revised quote.pdf',approval:'MATERIAL & BUDGET CHANGE',
    budget:['Cabinetry & furniture','Finishes & hardware'],comment:'The proportions look great. Could we compare the handle finishes?',
    portfolio:'Put your craftsmanship in front of your next client. Turn selected kitchens, bespoke pieces and cabinetry projects into connected showcases, using the photographs, details and testimonials you’ve reviewed.',
    detail:'Joinery & finishes'
  },
  events: {
    title:'You create the experience.',
    intro:'Bring your concepts, layouts, installation visuals and supplier proposals. AI builds a presentation that helps clients picture the atmosphere, follow the budget and make the decisions that bring it to life.',
    conversation:'Keep layout changes, supplier questions and creative decisions with the event. Attach a proposal and ask the client to confirm the choice, with any agreed cost change linked to the budget.',
    question:'The suspended lighting looks beautiful. Can we include it in the supplier proposal?',
    reply:'Here’s the revised lighting proposal and the additional cost for the installation.',
    item:'Suspended lighting installation',attachment:'Lighting supplier · revised proposal.pdf',approval:'EXPERIENCE & BUDGET CHANGE',
    budget:['Set design & lighting','Materials & production'],comment:'Love the atmosphere. Could we explore warmer lighting around the installation?',
    portfolio:'Let each experience lead to the next. Build showcases from your selected events, exhibitions and installations, bringing together the project visuals and client testimonials you want the world to see.',
    detail:'Atmosphere & installation'
  }
};

function selectAudience(id,announce=false){
  const profile=audiences[id],story=audienceStories[id];if(!profile||!story)return;
  const text=(selector,value)=>document.querySelectorAll(selector).forEach(el=>el.textContent=value);
  document.body.dataset.audience=id;
  document.querySelectorAll('[name="audience"]').forEach(input=>input.checked=input.value===id);
  const heading=document.querySelector('#hero-title');
  heading.replaceChildren(document.createTextNode(story.title),document.createElement('br'));
  const emphasis=document.createElement('em');emphasis.textContent='AI does the presentation.';heading.append(emphasis);
  text('.hero-copy>.eyebrow',`FOR ${profile.label.toUpperCase()}`);
  text('.hero-description',story.intro);
  updateAudienceChecks(id,profile,story);
  for(const image of document.querySelectorAll('.hero-image,.motion-scene img,.power-deck-image img,#demo-image,.ai-visual img,.portfolio-example-projects img,#expanded-image')){
    image.src=profile.image;image.alt=profile.alt;image.width=1200;image.height=800;
  }
  text('.hero-caption>span:first-child',`01 / ${profile.projectTitle.toUpperCase()}`);
  text('.hero-caption>span:last-child','ILLUSTRATIVE DESIGN CONCEPT');
  text('.power-deck-top>span:first-child,.communication-example .story-window-bar>span:first-child,#demo-project-name',profile.projectTitle.toUpperCase());
  text('.power-share-card>p>em,#demo-title,#image-dialog-title',profile.projectTitle);
  text('#demo-kicker,.portfolio-example-body>.eyebrow',profile.label.toUpperCase());
  text('.vision-overlay>span:last-child','CONCEPT 02 — '+profile.description.toUpperCase());
  text('.showcase-copy>p',profile.welcomeIntro);
  text('.communication-story .product-story-copy>p:not(.eyebrow)',story.conversation);
  text('.story-message:first-child p',story.question);text('.story-message:nth-child(2) p',story.reply);
  text('.communication-story .story-attachment',`↗ ${story.attachment}`);text('.story-approval .eyebrow',story.approval);text('.story-approval h3',story.item);
  text('.portfolio-story .product-story-copy>p:nth-of-type(2)',story.portfolio);
  text('.portfolio-example-body>h3',profile.headline);
  text('.portfolio-example-projects article:first-child>span',profile.projectTitle.toUpperCase());
  text('.portfolio-example-projects article:first-child h4','The project story.');
  text('.portfolio-example-projects article:last-child>span',story.detail.toUpperCase());
  text('.portfolio-example-projects article:last-child h4','A closer look.');
  text('.portfolio-example .story-example-note','Illustrative website · Example design imagery.');
  const budgetRows=document.querySelectorAll('#panel-budget .budget-row:not(.budget-total)');
  story.budget.forEach((label,index)=>budgetRows[index].querySelector('span').textContent=label);
  text('#sample-comments .sample-comment:first-child p',story.comment);
  document.dispatchEvent(new Event('studiodeck:audience'));
  if(announce)text('#audience-status',`Showing ${profile.label.toLowerCase()} imagery and examples.`);
  // The URL can be shared or refreshed without storing a preference in cookies.
  try{const url=new URL(location.href);url.searchParams.set('audience',id);history.replaceState(null,'',url);}catch{}
}
document.querySelectorAll('[name="audience"]').forEach(input=>input.addEventListener('change',()=>{
  selectAudience(input.value,true);
  input.closest('.audience-choice').scrollIntoView({block:'nearest',inline:'nearest'});
}));
const initialAudience=new URLSearchParams(location.search).get('audience');
selectAudience(Object.hasOwn(audiences,initialAudience)?initialAudience:'interior');
