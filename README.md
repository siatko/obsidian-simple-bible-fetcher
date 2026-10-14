<div align="center">

# More than a<br>Simple Bible Fetcher

An [Obsidian](https://obsidian.md) plugin that inserts Bible passages from the
free [bolls.life](https://bolls.life) API as Markdown quotes, and then goes
further: read, annotate and revisit, with colour-coded notes on any verse.

</div>

Type a reference, pick a translation, and the passage is inserted at the cursor
as a blockquote, one verse per line with a bold verse number:

```markdown
> **John 3,16** (The Holy Bible, Berean Standard Bible)
>
> **16** For God so loved the world that He gave His one and only Son, that everyone who believes in Him shall not perish but have eternal life.
> **17** For God did not send His Son into the world to condemn the world, but to save the world through Him.
```

Several references at once, separated by `;`:

```markdown
> **Genesis 1,1** (The Holy Bible, Berean Standard Bible)
>
> **1** In the beginning God created the heavens and the earth.

> **Psalm 23,1** (The Holy Bible, Berean Standard Bible)
>
> **1** The LORD is my shepherd; I shall not want.
```

A chapter range is expanded into one section per chapter:

```markdown
> **Psalm 23** (The Holy Bible, Berean Standard Bible)
>
> **1** The LORD is my shepherd; I shall not want.
> **2** He makes me lie down in green pastures.

> **Psalm 24** (The Holy Bible, Berean Standard Bible)
>
> **1** The earth is the LORD's, and everything in it.
```

Prefer running prose instead of one line per verse? Switch the format:

```markdown
> **John 3,16** (The Holy Bible, Berean Standard Bible)
>
> **16** For God so loved the world that He gave His one and only Son ...
```

Want the heading to link back to bolls.life? Turn on the source link:

```markdown
> [**John 3,16** (The Holy Bible, Berean Standard Bible)](https://bolls.life/BSB/43/3/16/)
>
> **16** For God so loved the world that He gave His one and only Son ...
```

Annotate any verse and the command creates a note for your thoughts, embedded
under the quote as a colour-coded callout:

```markdown
> **16** For God so loved the world ...

> [!zettel-yellow]
> ![[Bible Notes/John 3,16 (The Holy Bible, Berean Standard Bible)]]
```

## Features

- Insert passages via a command / hotkey.
- Reference parsing with book names, common abbreviations and book numbers
  (`John 3:16`, `1 Cor 13`, `Ps 23`, `43 3:16`, `Gen 1:1`).
- Multiple references at once, separated by `;` (`John 3:16; Psalm 23`).
- Chapter ranges (`Psalm 3-5`), inserted as one section per chapter.
- Footnotes from the source are rendered as Markdown footnotes.
- Three preset output formats, a custom template, and an optional source link.
- Keyword search across a translation, inserting the passage you pick.
- Annotate a verse: create a separate note for your thoughts and embed it
  under the verse, as a callout with a colour chosen from a dropdown or a
  palette, optionally with a date line, and as an embed or a plain link.
- Parallel translations: the main translation plus any number of additional
  translations at once.
- Every language offered by bolls.life, with the translation list and
  book-name matching following the chosen language.
- An offline cache: everything fetched once is reused, so it keeps working
  without a connection.

## Supported languages

Every language available on bolls.life can be selected. The translation list
and book-name matching follow the chosen language, so you can type book names
as that translation writes them (for example `Juan`, `Selon Jean` or `João`).
Books can always be given by their number (1-66).

German and English additionally understand common abbreviations
(`Joh`, `1 Mos`, `Psalm`, `John`), independently of the selected translation.

## Usage

1. Open a note and place the cursor where the passage should go.
2. Run a command from the command palette (`Ctrl/Cmd+P`), or assign it a
   hotkey under **Settings → Hotkeys**:
   - **Simple Bible Fetcher: Insert Bible quote**: enter a reference.
   - **Simple Bible Fetcher: Insert Bible quote (parallel translations)**:
     inserts the reference in every translation listed under
     **Parallel translations**.
   - **Simple Bible Fetcher: Search Bible (keyword)**: search the selected
     translation for a word or phrase and pick a hit to insert.
   - **Simple Bible Fetcher: Annotate verse (create note)**: put the cursor on
     an inserted verse, or select one or more verses, then name the note and
     pick a colour; it is created and embedded under the last selected verse
     (see below).
3. Enter a reference (or search term) and press `Enter`.

### Reference syntax

| Input                 | Meaning                             |
| --------------------- | ----------------------------------- |
| `John 3:16`           | single verse                        |
| `John 3:16-18`        | a verse range                       |
| `John 3:16.18`        | several single verses               |
| `Psalm 23`            | a whole chapter                     |
| `Psalm 3-5`           | a chapter range                     |
| `43 3:16`             | book by its number (1-66)           |
| `John 3:16; Psalm 23` | several references (also with `;`)  |

The `:` and `,` separators are interchangeable (`John 3:16` and `John 3,16`
both work). Book names are matched case-insensitively and ignore dots and
spaces, so
`1. Samuel`, `1 Samuel` and `1sam` all resolve to the same book. The heading
shows the book name as the chosen translation writes it.

A chapter range such as `Psalm 3-5` is shorthand for `Psalm 3; Psalm 4; Psalm 5`:
each chapter is inserted as its own section with its own heading, and its
footnotes follow that section. The order is the same whether you write
`Psalm 3-5` or `Psalm 5-3`. A chapter range cannot be combined with a verse
specification (`Psalm 3-5:2` is rejected); write the verses per chapter
instead.

## Text cleanup

The raw bolls.life text is normalized before it is inserted:

- Footnotes can be shown or stripped (see the **Footnotes** setting). When
  shown, the source markers become Markdown footnotes (`[^1]`) and the matching
  text from bolls.life is appended after each passage's section, with
  cross-references linking back to bolls.life. Translations without footnotes
  are unaffected.
- Formatting is preserved: source italics (`<i>`) and bold (`<b>`/`<strong>`)
  become Markdown `*…*` and `**…**`. Any other tags are stripped.
- Missing spaces are added after sentence punctuation, because the source
  occasionally glues sentences together (`…mein Gott!Erleuchte…` becomes
  `…mein Gott! Erleuchte…`).
- Square brackets are escaped if present (`[ertönt]` becomes `\[ertönt\]`), so
  words the translation added for clarity render literally instead of being
  treated as Markdown syntax.

## Settings

| Setting               | Description                                              |
| --------------------- | -------------------------------------------------------- |
| Language              | Translation language, and the book names recognized while typing. |
| Translation           | bolls.life translation, filtered to the selected language (e.g. `S00`, `LUT`; `BSB`, `WEB`). |
| Format                | `Blockquote, bold verse number`, `One blockquote per verse`, `Blockquote, running text`, or `Custom template`. |
| Passage template      | Template for the `Custom template` format (see below). Shown only for that format. |
| Verse template        | Template applied to each verse in the `Custom template` format. Shown only for that format. |
| Verse separator       | Text placed between verses. Use `\n` for a line break. Shown only for the `Custom template` format. |
| Footnotes             | Render source footnotes as Markdown footnotes, or strip the markers. |
| Source link           | Make the heading itself link to the passage on bolls.life. |
| Parallel translations | Additional translations inserted after the main one, comma-separated (e.g. `LUT, ELB`). The main translation is always included first (see below). |
| Note folder           | Folder for **Annotate verse** notes, with vault-folder autocomplete. Blank means the vault root. |
| Note format           | File name (and optional subfolders) for **Annotate verse** notes. Placeholders: `{title}`, `{reference}`, `{translation}`, `{book}`, `{chapter}`, `{verse}`, `{verses}`. A title is only asked for when the format contains `{title}`. |
| Note opens            | Where a new annotation note opens: `Split right` (default), `New tab`, or `Do not open`. |
| Note opens on click   | Where an embedded annotation note opens when you click it: `Current pane` (default, Obsidian's own behaviour), `Split right`, `New tab`, or `Do not open`. |
| Default note color    | Colour preselected when creating an annotation note. One of the ten built-in post-it colours. |
| Note color picker     | How the colour is chosen when creating a note: a `Dropdown` (default) or a `Palette` of swatches. |
| Date in annotation notes | Write a date line at the top of newly created annotation notes. |
| Date line             | The date line's template. Use `{date}` and `{time}`, optionally with a pattern (`{date:DD.MM.YYYY}`); surrounding text is kept literally. Patterns use `YYYY`, `YY`, `MM`, `M`, `DD`, `D`, `HH`, `H`, `mm`, `m`, `ss`, `s`. Shown only when the date is enabled. |
| Note link style       | How the annotation note appears under the verse: `Embedded` (default, `![[...]]`) or `Link` (`[[...]]`). |

## Custom template

With **Format → Custom template** you control the output yourself. The passage
template is rendered once per passage; `{verses}` is the verse template applied
to each verse and joined by the verse separator.

| Placeholder       | Meaning                                              |
| ----------------- | ---------------------------------------------------- |
| `{heading}`       | Formatted heading, e.g. `**John 3,16** (BSB)`.       |
| `{reference}`     | Reference without markup, e.g. `John 3,16`.          |
| `{book}`          | Book name as the translation writes it.              |
| `{chapter}`       | Chapter number.                                      |
| `{translation}`   | Translation code, e.g. `BSB`.                        |
| `{translationName}` | Full translation name.                             |
| `{sourceUrl}`     | bolls.life URL for the passage.                      |
| `{verses}`        | All verses (passage template only).                  |
| `{number}`, `{text}` | Verse number and text (verse template only).      |

The three presets are just built-in templates; the default custom template
reproduces `Blockquote, bold verse number`.

## Search

The **Search Bible (keyword)** command searches the whole selected translation
for a word or phrase. Matches are listed with their reference and a short text
preview in which the search term is highlighted, up to 100 results. Picking one
inserts that passage with the current format settings.

## Annotating verses

The **Annotate verse (create note)** command lets you attach your own thoughts
to a verse after you have inserted a passage. Put the cursor on the verse you
want to annotate, or select one or more verses, and run the command: it reads
the reference and its heading, creates a note and embeds it in a `zettel`
callout just below the quote. A selection spanning several verses becomes a
range such as `Johannes 3,16-18`. A selection that spans several chapters is
split per chapter, so each chapter gets its own note and callout directly below
that chapter's verses, for example `Markus 1,43-44` and `Lukas 1,1-2` from a
selection over both.

```markdown
> **16** Denn so hat Gott die Welt geliebt …

> [!zettel-yellow]
> ![[Bible Notes/Johannes 3,16 (Schlachter 2000)]]
```

The note is embedded inside a `zettel-<color>` callout, drawn as a post-it with
an always-visible coloured border. When you create a note, the dialog offers the
ten built-in colours and preselects the **Default note color**:
`yellow`, `orange`, `red`, `green`, `teal`, `blue`, `purple`, `pink`, `gray` and
`brown`. The **Note color picker** setting switches between a dropdown and a
palette of swatches. To present the note as a plain `[[...]]` link instead of an
embedded `![[...]]` note, set **Note link style** to `Link`.

Each colour is defined in `styles.css` as a variable, so to use your own colours
override them in a CSS snippet, either the variable or the callout itself:
`body .callout[data-callout="zettel-yellow"] { --callout-color: 212, 160, 23; }`.
With **Date in annotation notes** enabled, every new note starts with the
**Date line**, for example `Erstellt am {date:DD.MM.YYYY}`, so you know when you
wrote the annotation. When the note opens, the cursor is placed right after the
date line, ready for you to type.

Where the note goes is set by two settings, like the Daily Notes plugin. The
**Note folder** field has the same vault-folder autocomplete (blank means the
vault root), and **Note format** is the file name, which understands `{title}`,
`{reference}`, `{translation}`, `{book}`, `{chapter}`, `{verse}` and `{verses}` and
may contain subfolders, for example `{book}/{chapter}/{reference}`. The default
format is `{title}`. When it contains `{title}` the command asks for a title
(prefilled with the reference and the translation, e.g.
`Johannes 3,16 (Schlachter 2000)`); without `{title}` no title is asked and the
note is named from the format.

The quote stays a quote; the embedded note is your commentary and is created
empty (unless a **Date line** is configured), so you just write. The reference
already shows as the note title. The note
opens right away, by default in a split to the right (the **Note opens** setting
switches between split, new tab or not at all). Clicking the embedded note can
open it in a split or a new tab too, via the **Note opens on click** setting
(`Current pane` keeps Obsidian's own click behaviour). Because the note is a
normal file
you can also link to it, search it and collect it with backlinks or Dataview. If
a note with that path already exists it is reused, not overwritten. This works
with the `Blockquote, bold verse number` and `One blockquote per verse` formats,
which label each verse with `**{number}**`; the running-text format has no
per-verse line to anchor to.

With a **Custom template** the command reads the rendered Markdown back, so it
requires the same two patterns: each verse line must contain `**{number}**` (for
example `**16** text`) and the passage heading must contain `**{reference}**`
(optionally followed by `(translation)`, as in `**John 3,16** (BSB)`). If your
template drops the bold verse number or the bold heading, the command finds no
verse and shows a notice instead. The default custom template keeps both and
works. The callout itself is a self-contained block, so it never swallows the
verses below it, whatever the format.

## Parallel translations

The **Parallel translations** setting takes a comma-separated list of
additional translation codes, for example `LUT, ELB`. The command
**Insert Bible quote (parallel translations + main)** always inserts the main
translation first, then every listed translation, in the order given. Entering
a single code therefore yields two translations, not one:

Main **Translation** `S00` plus **Parallel translations** `LUT` gives:

```markdown
> **Das Evangelium nach Johannes 3,16** (Schlachter 2000)
>
> **16** Denn so \[sehr\] hat Gott die Welt geliebt, dass er seinen eingeborenen Sohn gab, damit jeder, der an ihn glaubt, nicht verlorengeht, sondern ewiges Leben hat.

> **Johannes 3,16** (Luther (1912))
>
> **16** Also hat Gott die Welt geliebt, daß er seinen eingeborenen Sohn gab, auf daß alle, die an ihn glauben, nicht verloren werden, sondern das ewige Leben haben.
```

If a listed code equals the main translation, it is inserted only once. Each
translation is inserted with all of its references together, and each
reference's footnotes follow that reference's section. Multiple references are
still separated by `;`.

## Offline cache

Fetched chapters, book lists and translation metadata are cached and reused on
later runs, so passages you have already looked up work without a connection.
The cache lives in the plugin's own data (`data.json`) alongside the settings.
It is unlimited and has no expiry. To clear it, remove the `cache` key from that
file; deleting the whole file also resets the settings.

## Installation

### Manual

Copy `main.js`, `manifest.json` and `styles.css` into
`<vault>/.obsidian/plugins/simple-bible-fetcher/` and enable the plugin under
**Settings → Community plugins**.

### From source

```bash
npm install
npm run build
```

Then copy the three files above into your vault, or symlink the project folder
into `<vault>/.obsidian/plugins/simple-bible-fetcher`.

## Development

```bash
npm install
npm run dev     # watch build
npm run build   # typecheck + production build
```

## Tests

The test suite runs on [Vitest](https://vitest.dev) with jsdom. The Obsidian
API is replaced by a stub (`test/obsidian-stub.ts`), and the bolls.life HTTP
layer is driven by fixtures (`test/fixtures.ts`), so the tests never hit the
network.

```bash
npm test              # run the suite once
npm run test:watch    # watch mode
npm run test:coverage # run with a coverage report
npm run typecheck:test # type-check the tests too
```

The suite covers reference parsing and book resolution, text cleanup and
footnotes, the output presets and the custom template, parallel translations
and their footnote placement, keyword search, the persistent cache, settings
persistence and the plugin commands, modals and settings tab. Coverage is
enforced at 100 % for statements, branches, functions and lines; a drop fails
the coverage run.

Because the suite runs against a stub rather than a real vault, it proves the
logic, not the Obsidian integration. A manual smoke test in Obsidian is still
worth doing before a release.

## License

GPL-3.0-or-later. See [LICENSE](LICENSE).
