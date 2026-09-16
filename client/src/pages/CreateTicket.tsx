import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, PlusCircle, X } from "lucide-react";
import {
  getCategories,
  getSystems,
  createTicket as apiCreateTicket,
  uploadAttachment,
  type Category,
  type RelatedSystem,
  type TicketPriority,
  type Ticket,
} from "../api";
import { useAuth } from "../hooks/useAuth";
import Button from "../components/Button";
import TextInput from "../components/TextInput";
import ValidationMessage from "../components/ValidationMessage";

const TITLE_MIN = 5;
const TITLE_MAX = 100;
const DESC_MIN = 10;
const DESC_MAX = 1000;

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_FILES = 5;

const PRIORITIES: TicketPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface FormErrors {
  title?: string;
  categoryId?: string;
  systemId?: string;
  priority?: string;
  description?: string;
  submit?: string;
}

type FormValues = {
  title: string;
  categoryId: string;
  systemId: string;
  priority: string;
  description: string;
};

const EMPTY_FORM: FormValues = {
  title: "",
  categoryId: "",
  systemId: "",
  priority: "",
  description: "",
};

export default function CreateTicket() {
  const { user: requester } = useAuth();
  const navigate = useNavigate();

  const [categories, setCategories] = useState<Category[]>([]);
  const [systems, setSystems] = useState<RelatedSystem[]>([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdTicket, setCreatedTicket] = useState<Ticket | null>(null);

  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadOptions = async () => {
      setIsLoadingOptions(true);
      setLoadError(null);
      try {
        const [cats, sys] = await Promise.all([getCategories(), getSystems()]);
        if (cancelled) return;
        setCategories(cats);
        setSystems(sys);
      } catch {
        if (cancelled) return;
        setLoadError("Unable to load Categories or Related Systems. Please try again later.");
      } finally {
        if (!cancelled) setIsLoadingOptions(false);
      }
    };

    loadOptions();

    return () => {
      cancelled = true;
    };
  }, []);

  const setField = (field: keyof FormValues, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const validate = (v: FormValues): FormErrors => {
    const next: FormErrors = {};
    const title = v.title.trim();
    const description = v.description.trim();

    if (!title) {
      next.title = "Title is required.";
    } else if (title.length < TITLE_MIN) {
      next.title = `Title must be at least ${TITLE_MIN} characters.`;
    } else if (title.length > TITLE_MAX) {
      next.title = `Title must be at most ${TITLE_MAX} characters.`;
    }

    if (!v.categoryId) next.categoryId = "Please select a Category.";
    if (!v.systemId) next.systemId = "Please select a Related System.";
    if (!v.priority) next.priority = "Please select a Priority.";

    if (!description) {
      next.description = "Description is required.";
    } else if (description.length < DESC_MIN) {
      next.description = `Description must be at least ${DESC_MIN} characters.`;
    } else if (description.length > DESC_MAX) {
      next.description = `Description must be at most ${DESC_MAX} characters.`;
    }

    return next;
  };

  const handleFilesSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    setAttachmentError(null);
    const incoming = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (incoming.length === 0) return;

    const next = [...stagedFiles];
    for (const file of incoming) {
      if (next.length >= MAX_FILES) {
        setAttachmentError(`You can attach up to ${MAX_FILES} files per ticket.`);
        break;
      }
      if (!ALLOWED_TYPES.includes(file.type as (typeof ALLOWED_TYPES)[number])) {
        setAttachmentError(`${file.name}: type not allowed. Use JPEG, PNG, WEBP, or PDF.`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        setAttachmentError(`${file.name} exceeds the 5 MB limit.`);
        continue;
      }
      next.push(file);
    }
    setStagedFiles(next);
  };

  const handleRemoveStaged = (index: number) => {
    setStagedFiles((prev) => prev.filter((_, i) => i !== index));
    setAttachmentError(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!requester || isSubmitting || createdTicket) return;

    const nextErrors = validate(values);
    setErrors(nextErrors);
    if (Object.values(nextErrors).some((e) => !!e)) return;

    setIsSubmitting(true);
    setErrors((prev) => ({ ...prev, submit: undefined }));
    try {
      const ticket = await apiCreateTicket(
        {
          title: values.title.trim(),
          description: values.description.trim(),
          categoryId: Number(values.categoryId),
          systemId: Number(values.systemId),
          priority: values.priority as TicketPriority,
        },
        requester.id
      );

      // Upload staged attachments to the newly created ticket. The ticket is
      // already created, so a failed individual upload must not lose it.
      for (const file of stagedFiles) {
        try {
          await uploadAttachment(ticket.id, file, requester.id);
        } catch {
          // Best-effort: the ticket remains; the user can add the file later.
        }
      }

      setCreatedTicket(ticket);
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        submit: err instanceof Error ? err.message : "Failed to create ticket. Please try again.",
      }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateAnother = () => {
    setValues(EMPTY_FORM);
    setErrors({});
    setCreatedTicket(null);
    setStagedFiles([]);
    setAttachmentError(null);
  };

  if (createdTicket) {
    return (
      <div
        className="min-vh-100 d-flex flex-column align-items-center justify-content-center p-4"
        style={{ backgroundColor: "#F5F7F6" }}
      >
        <div
          className="card shadow-sm border-0 rounded-3 p-4 p-md-5 w-100 bg-white"
          style={{ maxWidth: "768px" }}
          data-testid="create-ticket-success"
        >
          <div
            className="d-flex align-items-center p-3 mb-4 rounded"
            style={{ backgroundColor: "#EAF6EF", border: "1px solid #BBF7D0", color: "#006B3C" }}
            role="status"
          >
            <CheckCircle2 size={24} className="me-3 flex-shrink-0" />
            <div>
              <strong className="d-block">Ticket created successfully</strong>
              <span className="small">Your ticket has been submitted and is now pending.</span>
            </div>
          </div>

          <label className="form-label fw-bold small text-dark">Official Ticket Number</label>
          <div
            className="form-control p-3 text-dark fw-bold"
            style={{ backgroundColor: "#F1F0E9" }}
            data-testid="ticket-no"
          >
            {createdTicket.ticketNo}
          </div>

          <div className="d-flex justify-content-end gap-3 mt-4">
            <Button variant="secondary" onClick={handleCreateAnother}>
              Create Another
            </Button>
            <Button onClick={() => navigate(`/tickets/${createdTicket.id}`)}>View Ticket</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-vh-100 d-flex flex-column align-items-center p-4"
      style={{ backgroundColor: "#F5F7F6" }}
    >
      <div
        className="card shadow-sm border-0 rounded-3 p-4 p-md-5 w-100 my-4 bg-white"
        style={{ maxWidth: "768px" }}
      >
        <div className="mb-4">
          <div className="d-inline-flex align-items-center mb-2">
            <PlusCircle size={28} style={{ color: "#006B3C" }} className="me-2" />
            <h2 className="h4 fw-bold text-dark mb-0">Create Ticket</h2>
          </div>
          <p className="text-muted small mb-0">
            Fill in the details below to submit a new ticket. All required fields are marked with an
            asterisk.
          </p>
        </div>

        <hr className="text-muted opacity-25 mb-4" />

        {loadError && (
          <div data-testid="options-error" className="alert alert-danger py-2" role="alert">
            {loadError}
          </div>
        )}

        {isLoadingOptions ? (
          <div data-testid="options-loading">Loading Categories and Related Systems...</div>
        ) : (
          <form onSubmit={handleSubmit} noValidate data-testid="create-ticket-form">
            <TextInput
              id="ticket-title"
              label="Title"
              required
              data-testid="field-title"
              value={values.title}
              onChange={(e) => setField("title", e.target.value)}
              error={errors.title}
              maxLength={TITLE_MAX}
            />

            <div className="mb-3">
              <label className="form-label fw-bold small text-dark" htmlFor="ticket-category">
                Category <span className="text-danger">*</span>
              </label>
              <select
                id="ticket-category"
                data-testid="field-category"
                className="form-select"
                value={values.categoryId}
                onChange={(e) => setField("categoryId", e.target.value)}
                aria-invalid={errors.categoryId ? "true" : "false"}
              >
                <option value="" disabled>
                  -- Select Category --
                </option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
              {errors.categoryId && (
                <ValidationMessage>{errors.categoryId}</ValidationMessage>
              )}
            </div>

            <div className="mb-3">
              <label className="form-label fw-bold small text-dark" htmlFor="ticket-system">
                Related System <span className="text-danger">*</span>
              </label>
              <select
                id="ticket-system"
                data-testid="field-system"
                className="form-select"
                value={values.systemId}
                onChange={(e) => setField("systemId", e.target.value)}
                aria-invalid={errors.systemId ? "true" : "false"}
              >
                <option value="" disabled>
                  -- Select Related System --
                </option>
                {systems.map((sys) => (
                  <option key={sys.id} value={sys.id}>
                    {sys.name}
                  </option>
                ))}
              </select>
              {errors.systemId && <ValidationMessage>{errors.systemId}</ValidationMessage>}
            </div>

            <div className="mb-3">
              <label className="form-label fw-bold small text-dark" htmlFor="ticket-priority">
                Priority <span className="text-danger">*</span>
              </label>
              <select
                id="ticket-priority"
                data-testid="field-priority"
                className="form-select"
                value={values.priority}
                onChange={(e) => setField("priority", e.target.value)}
                aria-invalid={errors.priority ? "true" : "false"}
              >
                <option value="" disabled>
                  -- Select Priority --
                </option>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              {errors.priority && <ValidationMessage>{errors.priority}</ValidationMessage>}
            </div>

            <div className="mb-3">
              <label className="form-label fw-bold small text-dark" htmlFor="ticket-description">
                Description <span className="text-danger">*</span>
              </label>
              <textarea
                id="ticket-description"
                data-testid="field-description"
                className="form-control"
                rows={5}
                maxLength={DESC_MAX}
                value={values.description}
                onChange={(e) => setField("description", e.target.value)}
                aria-invalid={errors.description ? "true" : "false"}
              />
              {errors.description && <ValidationMessage>{errors.description}</ValidationMessage>}
            </div>

            <div className="mb-3">
              <label className="form-label fw-bold small text-dark" htmlFor="ticket-attachments">
                Attachments
              </label>
              <input
                id="ticket-attachments"
                data-testid="field-attachments"
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="form-control"
                onChange={handleFilesSelected}
                disabled={isSubmitting || stagedFiles.length >= MAX_FILES}
              />
              <div className="form-text">
                Attach up to {MAX_FILES} files (JPEG, PNG, WEBP, PDF; max 5 MB each).
              </div>
              {attachmentError && <ValidationMessage>{attachmentError}</ValidationMessage>}
              {stagedFiles.length > 0 && (
                <ul className="list-group mt-2" data-testid="staged-attachments">
                  {stagedFiles.map((file, index) => (
                    <li
                      key={`${file.name}-${index}`}
                      className="list-group-item d-flex align-items-center gap-2 py-2"
                    >
                      <div className="flex-grow-1 min-w-0">
                        <div className="text-truncate fw-semibold small">{file.name}</div>
                        <div className="text-secondary small">{formatBytes(file.size)}</div>
                      </div>
                      <button
                        type="button"
                        data-testid={`remove-staged-${index}`}
                        aria-label={`Remove ${file.name}`}
                        className="btn btn-sm btn-outline-danger d-inline-flex align-items-center"
                        onClick={() => handleRemoveStaged(index)}
                      >
                        <X size={16} aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {errors.submit && (
              <div data-testid="submit-error" className="text-danger small mb-2" role="alert">
                {errors.submit}
              </div>
            )}

            <div className="d-flex justify-content-end gap-3 mt-4">
              <Button variant="secondary" type="button" onClick={() => navigate("/")}>
                Cancel
              </Button>
              <Button type="submit" isLoading={isSubmitting} loadingText="Submitting...">
                Submit Ticket
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}