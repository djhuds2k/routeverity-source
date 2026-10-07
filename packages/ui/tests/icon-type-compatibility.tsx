import { createRef } from "react";
import type { Icon } from "../src/icons";
import * as replacements from "../src/icons/lucide-icons";
import { withFillVariant } from "../src/icons/with-fill-variant";

export const replacementIcons: Record<keyof typeof replacements, Icon> =
  replacements;

export const FilledCheck = withFillVariant(replacements.Check2);

export const compatibleProps = (
  <replacements.Check2
    ref={createRef<SVGSVGElement>()}
    variant="fill"
    size={18}
    strokeWidth={1.5}
    absoluteStrokeWidth
    width={20}
    height={20}
    className="size-5"
    aria-label="Selected"
    onClick={(event) => event.currentTarget.focus()}
  />
);
