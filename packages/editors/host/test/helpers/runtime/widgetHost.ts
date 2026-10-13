export interface FakeWidget {
  hidden: boolean;
}

export interface FakeWidgetHost {
  statsHud: FakeWidget | null;
  viewHelper: FakeWidget | null;
  metrics: {
    panel: FakeWidget | null;
  };
}

export function createWidgetHost(
  overrides: Partial<FakeWidgetHost> = {}
): FakeWidgetHost {
  return {
    statsHud: {
      hidden: false
    },
    viewHelper: {
      hidden: false
    },
    metrics: {
      panel: {
        hidden: true
      }
    },
    ...overrides
  };
}
