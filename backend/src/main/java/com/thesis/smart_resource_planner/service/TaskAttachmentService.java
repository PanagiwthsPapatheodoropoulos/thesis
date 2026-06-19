package com.thesis.smart_resource_planner.service;

import com.thesis.smart_resource_planner.enums.AuditAction;
import com.thesis.smart_resource_planner.model.dto.TaskAttachmentDTO;
import com.thesis.smart_resource_planner.model.entity.Task;
import com.thesis.smart_resource_planner.model.entity.TaskAttachment;
import com.thesis.smart_resource_planner.model.entity.User;
import com.thesis.smart_resource_planner.repository.TaskAttachmentRepository;
import com.thesis.smart_resource_planner.repository.TaskRepository;
import com.thesis.smart_resource_planner.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class TaskAttachmentService {

    private final TaskAttachmentRepository attachmentRepository;
    private final TaskRepository taskRepository;
    private final UserRepository userRepository;
    private final TaskAuditLogService auditLogService;

    @Transactional
    public TaskAttachmentDTO uploadAttachment(UUID taskId, UUID userId, MultipartFile file) throws IOException {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new IllegalArgumentException("Task not found with ID: " + taskId));

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found with ID: " + userId));

        // Clean filename to prevent path traversal issues
        String originalFilename = file.getOriginalFilename();
        String filename = originalFilename != null ? originalFilename.replaceAll("[/\\\\]", "") : "unnamed";

        // Validate allowed file extensions (best practice security)
        String extension = "";
        int i = filename.lastIndexOf('.');
        if (i > 0) {
            extension = filename.substring(i + 1).toLowerCase();
        }
        
        List<String> allowedExtensions = List.of(
            "pdf", "xlsx", "xls", "docx", "doc", "csv", "png", "jpg", "jpeg", "gif", "txt", "md", "zip", "rar", "tar", "gz"
        );
        
        if (!allowedExtensions.contains(extension)) {
            throw new IllegalArgumentException("File extension ." + extension + " is not allowed. Supported extensions are: " + String.join(", ", allowedExtensions));
        }

        TaskAttachment attachment = TaskAttachment.builder()
                .task(task)
                .filename(filename)
                .fileType(file.getContentType())
                .fileSize(file.getSize())
                .data(file.getBytes())
                .uploadedBy(user)
                .build();

        TaskAttachment saved = attachmentRepository.save(attachment);
        log.info("Successfully uploaded attachment: {} for task: {}", filename, taskId);

        // Log action in task history
        auditLogService.logTaskAction(task, user, AuditAction.ATTACHMENT_ADDED, 
                String.format("Uploaded file: %s (%d bytes)", filename, file.getSize()));

        return mapToDTO(saved);
    }

    @Transactional(readOnly = true)
    public List<TaskAttachmentDTO> getAttachmentsByTask(UUID taskId) {
        return attachmentRepository.findByTaskIdOrderByUploadedAtDesc(taskId).stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public TaskAttachment getAttachmentData(UUID id) {
        return attachmentRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Attachment not found with ID: " + id));
    }

    @Transactional
    public void deleteAttachment(UUID id, UUID userId) {
        TaskAttachment attachment = attachmentRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Attachment not found with ID: " + id));
        
        User user = userRepository.findById(userId).orElse(null);
        Task task = attachment.getTask();
        String filename = attachment.getFilename();

        attachmentRepository.delete(attachment);
        log.info("Deleted attachment: {} by user: {}", id, userId);

        if (task != null) {
            auditLogService.logTaskAction(task, user, AuditAction.ATTACHMENT_DELETED, 
                    String.format("Deleted file: %s", filename));
        }
    }

    private TaskAttachmentDTO mapToDTO(TaskAttachment attachment) {
        return TaskAttachmentDTO.builder()
                .id(attachment.getId())
                .taskId(attachment.getTask().getId())
                .filename(attachment.getFilename())
                .fileType(attachment.getFileType())
                .fileSize(attachment.getFileSize())
                .uploadedByUserId(attachment.getUploadedBy() != null ? attachment.getUploadedBy().getId() : null)
                .uploadedByUserName(attachment.getUploadedBy() != null ? attachment.getUploadedBy().getUsername() : "System")
                .uploadedAt(attachment.getUploadedAt())
                .build();
    }
}
