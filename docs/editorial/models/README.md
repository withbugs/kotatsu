# KOTATSU fictional model roster

KOTATSU may use recurring, entirely fictional AI-generated adults as exclusive editorial models. Their faces and full bodies may appear when a person genuinely improves the story. They are not based on photographed people, stock models, celebrities, public figures, or named real individuals.

The source of truth is `roster.json`. Reference sheets in `references/` are internal identity and persona locks, not article images and not assets to publish directly.

## Editorial idea

The roster represents people whose care for daily life appears in small actions. This does not mean wealth, spotless rooms, forced minimalism, or a single beige aesthetic. A repaired bag, a weather note, cleaned shoes, a dried cup, a wiped tool, or a wrapped book can carry the idea more honestly than a perfect interior.

## Roster

| ID | Name | Age | Gender | Persona |
| --- | --- | ---: | --- | --- |
| `K-01-NAO` | NAO | 27 | Woman | Mends a tote, buys one seasonal flower, and walks to a local bakery. |
| `K-02-RUI` | RUI | 34 | Nonbinary | Keeps a weather notebook, cooks seasonal soup, repairs textiles, and cycles. |
| `K-03-SOU` | SOU | 42 | Man | Visits used bookshops, cares for shoes, grinds coffee, and keeps a street map. |
| `K-04-MIKI` | MIKI | 49 | Woman | Enjoys an old compact car, local ceramics, markets, and complete record albums. |
| `K-05-KEI` | KEI | 58 | Man | Cleans tools, grows balcony herbs, listens to jazz, and records repairs. |
| `K-06-FUMI` | FUMI | 69 | Woman | Takes slow train trips, visits museums, wraps books, writes letters, and mends hems. |

The ages, genders, builds, faces, hair, colors, and habits deliberately vary. No person is the default KOTATSU reader, and no model should appear in every volume.

## Use rules

- Use a reference sheet as an identity reference whenever the same model returns. Preserve face, apparent age, hair, body proportions, and recurring identifying details.
- Wardrobe changes with the article and season. Do not make all models converge on the same white shirt and neutral trousers.
- Record `modelId` in the image sidecar when a roster model appears.
- A model may show their face or full body. The image and surrounding copy must still make clear that it is an AI-generated visual, not documentary photography or a real interview subject.
- Never assign a model a real employer, address, shop, quotation, biography, medical condition, or lived experience and present it as fact.
- Never prompt from or imitate a real person's face, name, photograph, distinctive styling, or likeness. If a generated face appears to resemble a known person, reject and regenerate it.
- Do not use the same model in adjacent article heroes unless an approved serial format requires continuity.
- Models are one visual form among several. Rotate them with environmental scenes, human details, object studies, illustration, collage, and wide street or interior views.
- A persona habit guides the visual brief but is not a required prop. Repeating the same action or room whenever a model appears would turn identity into a gimmick.

## Identity workflow

1. Select a model because the editorial persona fits the article, not merely to add a face.
2. Include the reference sheet as the identity reference and state the invariants in the prompt.
3. Generate the article-specific scene. Do not reuse the reference sheet or a previous article image as the finished visual.
4. Compare the result with the reference sheet and reject identity drift, age drift, body drift, or unexplained changes to stable features.
5. Compare the candidate with at least the two most recent article heroes and record the visual difference in sidecar metadata.
6. Review seasonality, real-person resemblance risk, hands, anatomy, logos, text, and reader-trust implications before handing the work to the managing editor.
