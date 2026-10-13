export interface LaunchNavigator {
  navigate(
    target: string,
    tag: string | null
  ): Promise<void>;
}
