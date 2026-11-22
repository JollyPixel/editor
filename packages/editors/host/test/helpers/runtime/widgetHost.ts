export interface FakeWidget {
  hidden: boolean;
}

export interface FakeWidgetHost {
  viewHelper: FakeWidget | null;
  metrics: {
    hud: FakeWidget | null;
    panel: FakeWidget | null;
  };
}

export function createWidgetHost(
  overrides: Partial<FakeWidgetHost> = {}
): FakeWidgetHost {
  return {
    viewHelper: {
      hidden: false
    },
    metrics: {
      hud: {
        hidden: false
      },
      panel: {
        hidden: true
      }
    },
    ...overrides
  };
}
