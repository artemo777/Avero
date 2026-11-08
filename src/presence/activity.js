const DEFAULTS = Object.freeze({
  details: "Compiling reality",
  state: "iℏ ∂ψ/∂t = Ĥψ",
  largeImageText: "Avero Development Environment",
  smallImageText: "Debugging the universe"
});

function clean(value, max = 128) {
  if (typeof value !== "string") return undefined;
  const result = value.trim().slice(0, max);
  return result || undefined;
}

function optionalUrl(value) {
  const candidate = clean(value, 512);
  if (!candidate) return undefined;
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Build a Discord SET_ACTIVITY payload. Image keys must match assets uploaded
 * to the Discord application identified by DISCORD_CLIENT_ID.
 */
export function buildActivity(env = process.env, startedAt = Date.now()) {
  const activity = {
    type: 0,
    details: clean(env.AVERO_RPC_DETAILS, 128) ?? DEFAULTS.details,
    state: clean(env.AVERO_RPC_STATE, 128) ?? DEFAULTS.state,
    timestamps: { start: Math.floor(startedAt / 1000) },
    assets: {}
  };

  const largeImage = clean(env.AVERO_RPC_LARGE_IMAGE, 256);
  const largeText = clean(env.AVERO_RPC_LARGE_TEXT, 128) ?? DEFAULTS.largeImageText;
  const smallImage = clean(env.AVERO_RPC_SMALL_IMAGE, 256);
  const smallText = clean(env.AVERO_RPC_SMALL_TEXT, 128) ?? DEFAULTS.smallImageText;

  if (largeImage) activity.assets.large_image = largeImage;
  if (largeText && largeImage) activity.assets.large_text = largeText;
  if (smallImage) activity.assets.small_image = smallImage;
  if (smallText && smallImage) activity.assets.small_text = smallText;
  if (Object.keys(activity.assets).length === 0) delete activity.assets;

  const buttonLabel = clean(env.AVERO_RPC_BUTTON_LABEL, 32);
  const buttonUrl = optionalUrl(env.AVERO_RPC_BUTTON_URL);
  if (buttonLabel && buttonUrl) activity.buttons = [{ label: buttonLabel, url: buttonUrl }];

  return activity;
}

export const DEFAULT_ACTIVITY = DEFAULTS;
