import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

class FakeClassList {
  private readonly names = new Set<string>();

  toggle(name: string, force?: boolean): boolean {
    if (force === true) {
      this.names.add(name);
      return true;
    }
    if (force === false) {
      this.names.delete(name);
      return false;
    }
    if (this.names.has(name)) {
      this.names.delete(name);
      return false;
    }
    this.names.add(name);
    return true;
  }

  contains(name: string): boolean {
    return this.names.has(name);
  }
}

class FakeElement {
  hidden = false;
  disabled = false;
  value = "";
  selected = false;
  readonly children: FakeElement[] = [];
  readonly classList = new FakeClassList();

  private textValue = "";
  private htmlValue = "";
  private readonly listeners = new Map<string, Array<(...args: unknown[]) => unknown>>();

  constructor(
    readonly tagName: string,
    readonly id = "",
  ) {}

  get textContent(): string {
    return this.textValue;
  }

  set textContent(value: string) {
    this.textValue = String(value);
  }

  get innerHTML(): string {
    return this.htmlValue;
  }

  set innerHTML(value: string) {
    this.htmlValue = String(value);
    this.children.length = 0;
  }

  appendChild(child: FakeElement): FakeElement {
    this.children.push(child);
    return child;
  }

  addEventListener(type: string, listener: (...args: unknown[]) => unknown): void {
    const existing = this.listeners.get(type) ?? [];
    existing.push(listener);
    this.listeners.set(type, existing);
  }
}

function loadEngineSwitcherSource(): string {
  const repoRoot = path.resolve(process.cwd(), "..", "..");
  return fs.readFileSync(path.join(repoRoot, "scripts", "preview", "engine-switcher.js"), "utf8");
}

function runEngineSwitcher(config: Record<string, unknown>) {
  const section = new FakeElement("section", "engine-switcher-section");
  const select = new FakeElement("select", "engine-switcher");
  const help = new FakeElement("p", "engine-switcher-help");
  help.textContent = "Only engines compatible with this document are listed. Switching saves the choice and reloads the preview.";

  const elements = new Map([
    [section.id, section],
    [select.id, select],
    [help.id, help],
  ]);

  const document = {
    getElementById(id: string): FakeElement | null {
      return elements.get(id) ?? null;
    },
    createElement(tagName: string): FakeElement {
      return new FakeElement(tagName);
    },
  };

  const window = {
    __DG_CONFIG: config,
    location: {
      reload() {
        throw new Error("reload should not run during initial render");
      },
    },
  };

  vm.runInNewContext(loadEngineSwitcherSource(), {
    window,
    document,
    fetch: async () => ({ ok: true }),
    console,
    encodeURIComponent,
  });

  return { section, select, help };
}

test("engine switcher keeps a single compatible engine visible", () => {
  const { section, select } = runEngineSwitcher({
    slug: "service-handshake-sequence",
    layout_engine: "sequence",
    compatible_engines: ["sequence"],
  });

  assert.equal(section.hidden, false);
  assert.equal(select.children.length, 1);
  assert.equal(select.children[0]?.value, "sequence");
  assert.equal(select.children[0]?.textContent, "sequence");
  assert.equal(select.children[0]?.selected, true);
  assert.equal(select.disabled, true);
});