import { expect, type Locator } from '@playwright/test';

// A slide carousel with Previous/Next buttons that shows a few slides at a time.
export class CarouselComponent {
  private readonly previousButton: Locator;
  private readonly nextButton: Locator;
  private readonly slides: Locator;

  constructor(private readonly region: Locator) {
    this.previousButton = region.getByRole('button', { name: 'Previous Slide' });
    this.nextButton = region.getByRole('button', { name: 'Next Slide' });
    this.slides = region.getByRole('group');
  }

  // Slides are labelled "Slide n of total".
  async slideCount(): Promise<number> {
    await expect(this.slides.first()).toBeVisible();
    const label = (await this.slides.first().getAttribute('aria-label')) ?? '';
    return Number(label.match(/of (\d+)/)?.[1] ?? 0);
  }

  async expectAtStart(): Promise<void> {
    await expect(this.previousButton).toBeDisabled();
    await expect(this.nextButton).toBeEnabled();
  }

  // Returns how many clicks it took for the button to disable itself.
  async scrollToEnd(): Promise<number> {
    return this.clickUntilDisabled(this.nextButton);
  }

  async scrollToStart(): Promise<number> {
    return this.clickUntilDisabled(this.previousButton);
  }

  async expectAtEnd(): Promise<void> {
    await expect(this.nextButton).toBeDisabled();
    await expect(this.previousButton).toBeEnabled();
  }

  async linkHrefs(name: string): Promise<string[]> {
    return this.linkAttribute(name, 'href');
  }

  async linkTargets(name: string): Promise<string[]> {
    return this.linkAttribute(name, 'target');
  }

  // Reads every matching link at once, after the slides have rendered.
  private async linkAttribute(name: string, attribute: string): Promise<string[]> {
    const links = this.region.getByRole('link', { name });
    await expect(links.first()).toBeVisible();
    return links.evaluateAll((elements, attr) => elements.map((element) => element.getAttribute(attr) ?? ''), attribute);
  }

  private async clickUntilDisabled(button: Locator): Promise<number> {
    const limit = await this.slideCount();
    let clicks = 0;

    while ((await button.isEnabled()) && clicks < limit) {
      await button.click();
      clicks++;
    }

    await expect(button).toBeDisabled();
    return clicks;
  }
}
