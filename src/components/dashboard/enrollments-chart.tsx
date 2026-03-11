"use client";

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

const chartData = [
  { mes: "Ene", inscritos: 180 },
  { mes: "Feb", inscritos: 210 },
  { mes: "Mar", inscritos: 260 },
  { mes: "Abr", inscritos: 240 },
  { mes: "May", inscritos: 280 },
  { mes: "Jun", inscritos: 320 },
];

const chartConfig = {
  inscritos: {
    label: "Inscritos",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

export function EnrollmentsChart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Inscripciones por mes</CardTitle>
        <CardDescription>Vista general del semestre actual</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[260px] w-full">
          <BarChart accessibilityLayer data={chartData}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="mes" tickLine={false} tickMargin={10} axisLine={false} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
            <Bar dataKey="inscritos" fill="var(--color-inscritos)" radius={8} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}