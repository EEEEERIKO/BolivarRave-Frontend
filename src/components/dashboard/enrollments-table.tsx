"use client";
"use no memo";

import * as React from "react";
import {
  ColumnDef,
  SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type CourseStatus = "Abierto" | "Cerrado" | "Cupo lleno";

type CourseRow = {
  codigo: string;
  materia: string;
  profesor: string;
  cupos: number;
  inscritos: number;
  estado: CourseStatus;
};

const rows: CourseRow[] = [
  {
    codigo: "INF-101",
    materia: "Programacion I",
    profesor: "Ana Mejia",
    cupos: 40,
    inscritos: 37,
    estado: "Abierto",
  },
  {
    codigo: "INF-204",
    materia: "Base de Datos",
    profesor: "Carlos Rojas",
    cupos: 35,
    inscritos: 35,
    estado: "Cupo lleno",
  },
  {
    codigo: "ADM-302",
    materia: "Investigacion de Operaciones",
    profesor: "Laura Pineda",
    cupos: 30,
    inscritos: 19,
    estado: "Abierto",
  },
  {
    codigo: "DER-117",
    materia: "Derecho Constitucional",
    profesor: "Pedro Arias",
    cupos: 32,
    inscritos: 32,
    estado: "Cerrado",
  },
];

function statusVariant(status: CourseStatus): "default" | "secondary" | "destructive" {
  if (status === "Abierto") return "default";
  if (status === "Cupo lleno") return "secondary";
  return "destructive";
}

export function EnrollmentsTable() {
  const [sorting, setSorting] = React.useState<SortingState>([]);

  const columns = React.useMemo<ColumnDef<CourseRow>[]>(
    () => [
      {
        accessorKey: "codigo",
        header: "Codigo",
      },
      {
        accessorKey: "materia",
        header: "Materia",
      },
      {
        accessorKey: "profesor",
        header: "Profesor",
      },
      {
        accessorKey: "cupos",
        header: ({ column }) => (
          <Button
            variant="ghost"
            className="-ml-3"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Cupos
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
      },
      {
        accessorKey: "inscritos",
        header: ({ column }) => (
          <Button
            variant="ghost"
            className="-ml-3"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Inscritos
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
      },
      {
        accessorKey: "estado",
        header: "Estado",
        cell: ({ row }) => (
          <Badge variant={statusVariant(row.original.estado)}>{row.original.estado}</Badge>
        ),
      },
    ],
    []
  );

  // TanStack Table is intentionally used here; this warning is expected with React Compiler.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: rows,
    columns,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
    },
  });

  return (
    <div className="rounded-xl border bg-card">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-20 text-center">
                Sin resultados.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}