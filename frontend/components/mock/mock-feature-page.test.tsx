import { render, screen } from "@testing-library/react";
import { Settings } from "lucide-react";
import { describe, expect, it } from "vitest";

import { MockFeaturePage } from "@/components/mock/mock-feature-page";
import { settingsPageMock } from "@/lib/mocks/settings";

describe("MockFeaturePage", () => {
  it("renders explicit mock data instead of placeholder-only content", () => {
    render(<MockFeaturePage icon={Settings} data={settingsPageMock} />);

    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByText("Mock-backed preview")).toBeInTheDocument();
    expect(screen.getByText("Configured Policies")).toBeInTheDocument();
    expect(screen.getByText("Organization Preferences")).toBeInTheDocument();
  });
});
