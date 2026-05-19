using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tickets.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "public");

            migrationBuilder.CreateTable(
                name: "cases",
                schema: "public",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    student_name = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    category = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    z_id = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: true),
                    created_by_device_id = table.Column<Guid>(type: "uuid", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    assigned_staff_id = table.Column<Guid>(type: "uuid", nullable: true),
                    started_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    resolved_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    escalated_to = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    resolved_on_site = table.Column<bool>(type: "boolean", nullable: true),
                    escalated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    version = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_cases", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "feedback_sessions",
                schema: "public",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    case_id = table.Column<Guid>(type: "uuid", nullable: false),
                    staff_id = table.Column<Guid>(type: "uuid", nullable: false),
                    device_id = table.Column<Guid>(type: "uuid", nullable: false),
                    status = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    expire_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    delivered_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    submitted_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    cancelled_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    overridden_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    expired_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    rating = table.Column<int>(type: "integer", nullable: true),
                    comment = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    version = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_feedback_sessions", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "kiosk_devices",
                schema: "public",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    secret_hash = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    mode = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    pairing_status = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    last_seen_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    is_connected = table.Column<bool>(type: "boolean", nullable: false),
                    current_lock_id = table.Column<Guid>(type: "uuid", nullable: true),
                    current_lock_staff_id = table.Column<Guid>(type: "uuid", nullable: true),
                    current_lock_case_id = table.Column<Guid>(type: "uuid", nullable: true),
                    current_lock_created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    current_lock_lease_expire_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    current_lock_version = table.Column<long>(type: "bigint", nullable: true),
                    version = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_kiosk_devices", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "staff",
                schema: "public",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    identity_key = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    email = table.Column<string>(type: "character varying(254)", maxLength: 254, nullable: false),
                    employee_no = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    role = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    name = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    version = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_staff", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_cases_status_created_at",
                schema: "public",
                table: "cases",
                columns: new[] { "status", "created_at" });

            migrationBuilder.CreateIndex(
                name: "IX_feedback_sessions_case_id_status",
                schema: "public",
                table: "feedback_sessions",
                columns: new[] { "case_id", "status" });

            migrationBuilder.CreateIndex(
                name: "IX_feedback_sessions_device_id_status",
                schema: "public",
                table: "feedback_sessions",
                columns: new[] { "device_id", "status" });

            migrationBuilder.CreateIndex(
                name: "IX_feedback_sessions_status_expire_at",
                schema: "public",
                table: "feedback_sessions",
                columns: new[] { "status", "expire_at" });

            migrationBuilder.CreateIndex(
                name: "IX_kiosk_devices_last_seen_at",
                schema: "public",
                table: "kiosk_devices",
                column: "last_seen_at");

            migrationBuilder.CreateIndex(
                name: "IX_kiosk_devices_pairing_status",
                schema: "public",
                table: "kiosk_devices",
                column: "pairing_status");

            migrationBuilder.CreateIndex(
                name: "IX_staff_email",
                schema: "public",
                table: "staff",
                column: "email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_staff_employee_no",
                schema: "public",
                table: "staff",
                column: "employee_no",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_staff_identity_key",
                schema: "public",
                table: "staff",
                column: "identity_key",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "cases",
                schema: "public");

            migrationBuilder.DropTable(
                name: "feedback_sessions",
                schema: "public");

            migrationBuilder.DropTable(
                name: "kiosk_devices",
                schema: "public");

            migrationBuilder.DropTable(
                name: "staff",
                schema: "public");
        }
    }
}
