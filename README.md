# enchanted-skills

Agent skills from [undefine](https://github.com/undefine-org), written for
Claude Code and usable by any harness that reads a `SKILL.md`.

| Skill | What it does |
|---|---|
| [`bl-org-dossier`](bl-org-dossier/SKILL.md) | Turns one `.bl.org` file into a live, mobile-first design dossier: semantic blocks (jobs, phone screens, desks, schemas, procedures, decisions, questions), executable Beam Lisp cells, and answers written back into the file. Mockups render in real design languages (`bl-org-dossier/kit/lang/`). |
| [`ux-from-use`](ux-from-use/SKILL.md) | Turns what someone met while using an app into the experience to establish: the structural cause, the fix, a manual session in a real browser with Beam Lisp's browser namespace, and a filmed scenario with model turns on tape (`ux-from-use/templates/`). |

## Install

Link a skill into your skills folder:

```sh
git clone git@github.com:undefine-org/enchanted-skills.git ~/projects/enchanted-skills
ln -s ~/projects/enchanted-skills/bl-org-dossier ~/.claude/skills/bl-org-dossier
ln -s ~/projects/enchanted-skills/ux-from-use ~/.claude/skills/ux-from-use
```

The dossier kit runs on [Beam Lisp](https://github.com/undefine-org) (`bl`).
Tests: `bl test -p bl-org-dossier/kit bl-org-dossier/kit/test/kit_test.bl`.
