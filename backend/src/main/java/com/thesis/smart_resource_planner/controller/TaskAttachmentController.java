package com.thesis.smart_resource_planner.controller;

import com.thesis.smart_resource_planner.model.dto.TaskAttachmentDTO;
import com.thesis.smart_resource_planner.model.entity.TaskAttachment;
import com.thesis.smart_resource_planner.security.UserPrincipal;
import com.thesis.smart_resource_planner.service.TaskAttachmentService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/tasks/attachments")
@RequiredArgsConstructor
@Slf4j
public class TaskAttachmentController {

    private final TaskAttachmentService attachmentService;

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'EMPLOYEE')")
    public ResponseEntity<TaskAttachmentDTO> uploadAttachment(
            @RequestParam("taskId") UUID taskId,
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        
        try {
            if (file.isEmpty()) {
                return ResponseEntity.badRequest().build();
            }

            TaskAttachmentDTO dto = attachmentService.uploadAttachment(taskId, currentUser.getId(), file);
            return ResponseEntity.status(HttpStatus.CREATED).body(dto);
        } catch (IllegalArgumentException e) {
            log.error("Invalid arguments for file upload: {}", e.getMessage());
            return ResponseEntity.badRequest().header("X-Error-Message", e.getMessage()).build();
        } catch (Exception e) {
            log.error("Error uploading file: ", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/task/{taskId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'EMPLOYEE')")
    public ResponseEntity<List<TaskAttachmentDTO>> getAttachmentsByTask(@PathVariable UUID taskId) {
        try {
            List<TaskAttachmentDTO> list = attachmentService.getAttachmentsByTask(taskId);
            return ResponseEntity.ok(list);
        } catch (Exception e) {
            log.error("Error retrieving attachments list: ", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/{id}/download")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'EMPLOYEE')")
    public ResponseEntity<Resource> downloadAttachment(@PathVariable UUID id) {
        try {
            TaskAttachment attachment = attachmentService.getAttachmentData(id);

            ByteArrayResource resource = new ByteArrayResource(attachment.getData());
            
            // Handle filename with UTF-8 support
            ContentDisposition contentDisposition = ContentDisposition.attachment()
                    .filename(attachment.getFilename(), StandardCharsets.UTF_8)
                    .build();

            MediaType mediaType;
            try {
                mediaType = MediaType.parseMediaType(attachment.getFileType());
            } catch (Exception e) {
                mediaType = MediaType.APPLICATION_OCTET_STREAM;
            }

            return ResponseEntity.ok()
                    .contentType(mediaType)
                    .contentLength(attachment.getFileSize())
                    .header(HttpHeaders.CONTENT_DISPOSITION, contentDisposition.toString())
                    .body(resource);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            log.error("Error downloading file attachment: ", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'EMPLOYEE')")
    public ResponseEntity<Void> deleteAttachment(
            @PathVariable UUID id,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        try {
            attachmentService.deleteAttachment(id, currentUser.getId());
            return ResponseEntity.noContent().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            log.error("Error deleting attachment: ", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
}
