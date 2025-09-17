import { z } from "zod";

export const NavigateTool = z.object({
  name: z.literal("browser_navigate"),
  description: z.literal("Navigate to a URL"),
  arguments: z.object({
    url: z.string().describe("The URL to navigate to"),
  }),
});

export const GoBackTool = z.object({
  name: z.literal("browser_go_back"),
  description: z.literal("Go back to the previous page"),
  arguments: z.object({}),
});

export const GoForwardTool = z.object({
  name: z.literal("browser_go_forward"),
  description: z.literal("Go forward to the next page"),
  arguments: z.object({}),
});

export const SnapshotTool = z.object({
  name: z.literal("browser_snapshot"),
  description: z.literal("Capture accessibility snapshot of the current page"),
  arguments: z.object({}),
});

export const ClickTool = z.object({
  name: z.literal("browser_click"),
  description: z.literal("Perform click on a web page"),
  arguments: z.object({
    element: z.string().describe("Human-readable element description"),
    ref: z.string().describe("Exact target element reference from the page snapshot"),
  }),
});

export const HoverTool = z.object({
  name: z.literal("browser_hover"),
  description: z.literal("Hover over element on page"),
  arguments: z.object({
    element: z.string().describe("Human-readable element description"),
    ref: z.string().describe("Exact target element reference from the page snapshot"),
  }),
});

export const TypeTool = z.object({
  name: z.literal("browser_type"),
  description: z.literal("Type text into editable element"),
  arguments: z.object({
    element: z.string().describe("Human-readable element description"),
    ref: z.string().describe("Exact target element reference from the page snapshot"),
    text: z.string().describe("Text to type into the element"),
    submit: z.boolean().describe("Whether to submit entered text (press Enter after)"),
  }),
});

export const SelectOptionTool = z.object({
  name: z.literal("browser_select_option"),
  description: z.literal("Select an option in a dropdown"),
  arguments: z.object({
    element: z.string().describe("Human-readable element description"),
    ref: z.string().describe("Exact target element reference from the page snapshot"),
    values: z.array(z.string()).describe("Array of values to select in the dropdown"),
  }),
});

export const PressKeyTool = z.object({
  name: z.literal("browser_press_key"),
  description: z.literal("Press a key on the keyboard"),
  arguments: z.object({
    key: z.string().describe("Name of the key to press or a character to generate"),
  }),
});

export const WaitTool = z.object({
  name: z.literal("browser_wait"),
  description: z.literal("Wait for a specified time in seconds"),
  arguments: z.object({
    time: z.number().describe("The time to wait in seconds"),
  }),
});

export const GetConsoleLogsTool = z.object({
  name: z.literal("browser_get_console_logs"),
  description: z.literal("Get the console logs from the browser"),
  arguments: z.object({}),
});

export const ScreenshotTool = z.object({
  name: z.literal("browser_screenshot"),
  description: z.literal("Take a screenshot of the current page"),
  arguments: z.object({}),
});

export const DragTool = z.object({
  name: z.literal("browser_drag"),
  description: z.literal("Drag from one element to another"),
  arguments: z.object({
    startElement: z.string().describe("Human-readable description of start element"),
    startRef: z.string().describe("Reference to start element from page snapshot"),
    endElement: z.string().describe("Human-readable description of end element"),
    endRef: z.string().describe("Reference to end element from page snapshot"),
  }),
});