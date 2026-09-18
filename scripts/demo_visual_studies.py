"""Shared additions to the three fictional demo decks; no image API calls."""
import json

def add_visual_studies(bundle, slides):
    additions=json.loads((bundle/'additional-slides.json').read_text())
    for item in additions:
        index=next(n for n,s in enumerate(slides) if s['key']==item['after'])+1
        slides.insert(index,dict(image=item['key'],section='designs',kind='board',
                                 points=[],situation='concept',**{k:v for k,v in item.items() if k!='after'}))
    return [s['key'] for s in additions]
