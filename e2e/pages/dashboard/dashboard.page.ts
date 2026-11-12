import { expect, type Locator, type Page } from '@playwright/test';
import { appConfig } from '../../utils/config';
import { CarouselComponent } from './carousel.component';

export type DashboardTab = 'Home' | 'SMS' | 'Email' | 'Activity Stream';

export const dashboardTabPaths: Record<DashboardTab, string> = {
  Home: '/dashboard/home',
  SMS: '/dashboard/sms',
  Email: '/dashboard/email',
  'Activity Stream': '/dashboard/activity-stream',
};

export class DashboardPage {
  readonly productCarousel: CarouselComponent;
  readonly resourcesCarousel: CarouselComponent;

  private readonly tabSections: Record<DashboardTab, Locator>;

  constructor(private readonly page: Page) {
    // Both carousels are labelled just "Carousel", so tell them apart by their links.
    const carousels = page.getByRole('region', { name: 'Carousel' });
    const productRegion = carousels.filter({ has: page.getByRole('link', { name: 'Connect with Sales' }) });
    const resourcesRegion = carousels.filter({ has: page.getByRole('link', { name: 'Know More' }) });
    this.productCarousel = new CarouselComponent(productRegion);
    this.resourcesCarousel = new CarouselComponent(resourcesRegion);

    // One section that only that tab's view renders.
    this.tabSections = {
      Home: productRegion,
      SMS: page.getByRole('heading', { name: 'Overall Performance' }),
      Email: page.getByRole('heading', { name: 'Monthly Campaigns Status' }),
      'Activity Stream': page.getByRole('columnheader', { name: 'Message' }),
    };
  }

  async open(tab: DashboardTab = 'Home'): Promise<void> {
    await this.page.goto(new URL(dashboardTabPaths[tab], appConfig.appUrl).toString(), {
      waitUntil: 'domcontentloaded',
    });
  }

  async openTab(tab: DashboardTab): Promise<void> {
    await this.tab(tab).click();
  }

  async expectTabShown(tab: DashboardTab): Promise<void> {
    await expect(this.page).toHaveURL(new RegExp(`${dashboardTabPaths[tab]}$`));
    await expect(this.tab(tab)).toHaveClass(/\bselected\b/);
    await expect(this.tabSections[tab]).toBeVisible();
  }

  // The tabs are the only elements with this class, so the nav's SMS/Email entries don't match.
  private tab(tab: DashboardTab): Locator {
    return this.page.locator('.module-name').filter({ hasText: new RegExp(`^\\s*${tab}\\s*$`) });
  }
}
