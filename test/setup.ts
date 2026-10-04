import { beforeEach } from "vitest";
import { Modal, Notice, resetRequestUrlHandler } from "./obsidian-stub";
import { setBibleCache } from "../src/bible";

type ElOptions = {
  cls?: string | string[];
  text?: string;
  attr?: Record<string, string>;
} & Record<string, unknown>;

function applyOptions(el: HTMLElement, options?: ElOptions): void {
  if (!options) return;
  const { cls, text, attr, ...rest } = options;
  if (cls) el.className = Array.isArray(cls) ? cls.join(" ") : cls;
  if (typeof text === "string") el.textContent = text;
  if (attr) {
    for (const [key, value] of Object.entries(attr)) {
      el.setAttribute(key, value);
    }
  }
  for (const [key, value] of Object.entries(rest)) {
    try {
      (el as unknown as Record<string, unknown>)[key] = value;
    } catch {
      // Ignore properties the element does not support.
    }
  }
}

function installDomHelpers(): void {
  const proto = HTMLElement.prototype as unknown as Record<string, unknown>;

  if (typeof proto.createEl !== "function") {
    proto.createEl = function (
      this: HTMLElement,
      tag: string,
      options?: ElOptions
    ): HTMLElement {
      const el = document.createElement(tag);
      applyOptions(el, options);
      this.appendChild(el);
      return el;
    };
  }

  proto.createDiv = function (
    this: HTMLElement,
    options?: ElOptions
  ): HTMLElement {
    return (this as unknown as { createEl: Function }).createEl("div", options);
  };

  proto.createSpan = function (
    this: HTMLElement,
    options?: ElOptions
  ): HTMLElement {
    return (this as unknown as { createEl: Function }).createEl("span", options);
  };

  proto.addClass = function (this: HTMLElement, ...classes: string[]): void {
    this.classList.add(...classes);
  };

  proto.removeClass = function (this: HTMLElement, ...classes: string[]): void {
    this.classList.remove(...classes);
  };

  proto.toggleClass = function (
    this: HTMLElement,
    cls: string,
    value: boolean
  ): void {
    this.classList.toggle(cls, value);
  };

  proto.empty = function (this: HTMLElement): void {
    while (this.firstChild) this.removeChild(this.firstChild);
  };

  proto.setText = function (this: HTMLElement, text: string): void {
    this.textContent = text;
  };

  proto.setAttr = function (
    this: HTMLElement,
    name: string,
    value: string
  ): void {
    this.setAttribute(name, value);
  };
}

installDomHelpers();

beforeEach(() => {
  Modal.reset();
  Notice.reset();
  resetRequestUrlHandler();
  setBibleCache(null);
});
