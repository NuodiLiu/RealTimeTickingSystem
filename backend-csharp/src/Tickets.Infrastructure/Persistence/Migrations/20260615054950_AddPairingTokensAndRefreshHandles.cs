using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tickets.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPairingTokensAndRefreshHandles : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "pairing_tokens",
                schema: "public",
                columns: table => new
                {
                    token = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    expire_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    consumed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pairing_tokens", x => x.token);
                });

            migrationBuilder.CreateTable(
                name: "refresh_handles",
                schema: "public",
                columns: table => new
                {
                    handle = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    staff_id = table.Column<Guid>(type: "uuid", nullable: false),
                    expire_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_refresh_handles", x => x.handle);
                });

            migrationBuilder.CreateIndex(
                name: "IX_pairing_tokens_expire_at",
                schema: "public",
                table: "pairing_tokens",
                column: "expire_at");

            migrationBuilder.CreateIndex(
                name: "IX_refresh_handles_expire_at",
                schema: "public",
                table: "refresh_handles",
                column: "expire_at");

            migrationBuilder.CreateIndex(
                name: "IX_refresh_handles_staff_id",
                schema: "public",
                table: "refresh_handles",
                column: "staff_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "pairing_tokens",
                schema: "public");

            migrationBuilder.DropTable(
                name: "refresh_handles",
                schema: "public");
        }
    }
}
