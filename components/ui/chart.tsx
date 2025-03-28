// components/ui/chart.tsx
import * as React from "react"

const Chart = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div className="rounded-md border" ref={ref} {...props} />
))
Chart.displayName = "Chart"

const ChartContainer = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div className="p-4" ref={ref} {...props} />,
)
ChartContainer.displayName = "ChartContainer"

const ChartTooltip = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div className="bg-white rounded-md shadow-md p-2" ref={ref} {...props} />,
)
ChartTooltip.displayName = "ChartTooltip"

const ChartTooltipContent = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => <p className="text-sm text-gray-700" ref={ref} {...props} />,
)
ChartTooltipContent.displayName = "ChartTooltipContent"

const ChartLegend = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div className="flex items-center space-x-2" ref={ref} {...props} />,
)
ChartLegend.displayName = "ChartLegend"

const ChartLegendItem = React.forwardRef<HTMLDivElement, { color: string } & React.HTMLAttributes<HTMLDivElement>>(
  ({ className, color, ...props }, ref) => (
    <div className="flex items-center space-x-1" ref={ref} {...props}>
      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
    </div>
  ),
)
ChartLegendItem.displayName = "ChartLegendItem"

export { Chart, ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendItem }

