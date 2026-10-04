# Simple Bible Fetcher

An [Obsidian](https://obsidian.md) plugin that inserts Bible passages from the
free [bolls.life](https://bolls.life) API as Markdown quotes.

Type a reference, pick a translation, and the passage is inserted at the cursor
as a blockquote, one verse per line with a bold verse number.

```markdown
> **John 3,16** (The Holy Bible, Berean Standard Bible)
>
> **16** For God so loved the world that He gave His one and only Son, that everyone who believes in Him shall not perish but have eternal life.
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

## Features

- Insert passages via a command / hotkey.
- Reference parsing with book names, common abbreviations and book numbers
  (`John 3:16`, `1 Cor 13`, `Ps 23`, `43 3:16`, `Gen 1:1`).
- Multiple references at once, separated by `;` (`John 3:16; Psalm 23`).
- Footnotes from the source are rendered as Markdown footnotes.
- Three output formats and an optional source link.
- Every language offered by bolls.life, with the translation list and
  book-name matching following the chosen language.

## Supported languages

Every language available on bolls.life can be selected. The translation list
and book-name matching follow the chosen language, so you can type book names
as that translation writes them (for example `Juan`, `Selon Jean` or `João`).
Books can always be given by their number (1–66).

German and English additionally understand common abbreviations
(`Joh`, `1 Mos`, `Psalm`, `John`), independently of the selected translation.

## Usage

1. Open a note and place the cursor where the passage should go.
2. Run the command **Simple Bible Fetcher: Insert Bible quote** from the command
   palette (`Ctrl/Cmd+P`), or assign it a hotkey under
   **Settings → Hotkeys**.
3. Enter a reference and press `Enter`.

### Reference syntax

| Input                 | Meaning                             |
| --------------------- | ----------------------------------- |
| `John 3:16`           | single verse                        |
| `John 3:16-18`        | a verse range                       |
| `John 3:16.18`        | several single verses               |
| `Psalm 23`            | a whole chapter                     |
| `43 3:16`             | book by its number (1–66)           |
| `John 3:16; Psalm 23` | several references (also with `;`)  |

The `:` and `,` separators are interchangeable (`John 3:16` and `John 3,16`
both work). Book names are matched case-insensitively and ignore dots and
spaces, so
`1. Samuel`, `1 Samuel` and `1sam` all resolve to the same book. The heading
shows the book name as the chosen translation writes it.

## Text cleanup

The raw bolls.life text is normalized before it is inserted:

- Footnotes can be shown or stripped (see the **Footnotes** setting). When
  shown, the source markers become Markdown footnotes (`[^1]`) and the matching
  text from bolls.life is appended at the end of the quote, with
  cross-references linking back to bolls.life. Translations without footnotes
  are unaffected.
- Formatting tags are stripped.
- Missing spaces are added after sentence punctuation, because the source
  occasionally glues sentences together (`…mein Gott!Erleuchte…` becomes
  `…mein Gott! Erleuchte…`).
- Square brackets are escaped if present (`[ertönt]` becomes `\[ertönt\]`), so
  words the translation added for clarity render literally instead of being
  treated as Markdown syntax.

## Settings

| Setting     | Description                                              |
| ----------- | -------------------------------------------------------- |
| Language    | Translation language, and the book names recognized while typing. |
| Translation | bolls.life translation, filtered to the selected language (e.g. `S00`, `LUT`; `BSB`, `WEB`). |
| Format      | `Blockquote, bold verse number`, `One blockquote per verse`, or `Blockquote, running text`. |
| Footnotes   | Render source footnotes as Markdown footnotes, or strip the markers. |
| Source link | Make the heading itself link to the passage on bolls.life. |

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

## License

GPL-3.0-or-later. See [LICENSE](LICENSE).
