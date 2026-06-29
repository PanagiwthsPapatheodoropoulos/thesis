package com.thesis.smart_resource_planner.service;

import com.thesis.smart_resource_planner.enums.AuditAction;
import com.thesis.smart_resource_planner.model.dto.TaskAttachmentDTO;
import com.thesis.smart_resource_planner.model.entity.Task;
import com.thesis.smart_resource_planner.model.entity.TaskAttachment;
import com.thesis.smart_resource_planner.model.entity.User;
import com.thesis.smart_resource_planner.repository.TaskAttachmentRepository;
import com.thesis.smart_resource_planner.repository.TaskRepository;
import com.thesis.smart_resource_planner.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("TaskAttachmentService Dedicated Tests")
class TaskAttachmentServiceDedicatedTest {

    @Mock
    private TaskAttachmentRepository attachmentRepository;

    @Mock
    private TaskRepository taskRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private TaskAuditLogService auditLogService;

    @InjectMocks
    private TaskAttachmentService attachmentService;

    private UUID taskId;
    private UUID userId;
    private Task testTask;
    private User testUser;
    private MultipartFile mockFile;

    @BeforeEach
    void setUp() {
        taskId = UUID.randomUUID();
        userId = UUID.randomUUID();

        testTask = new Task();
        testTask.setId(taskId);
        testTask.setTitle("Test Task");

        testUser = new User();
        testUser.setId(userId);
        testUser.setUsername("testuser");

        mockFile = mock(MultipartFile.class);
    }

    @Test
    @DisplayName("Should upload attachment successfully when parameters are valid")
    void testUploadAttachment_Success() throws IOException {
        byte[] fileContent = new byte[]{1, 2, 3};
        when(taskRepository.findById(taskId)).thenReturn(Optional.of(testTask));
        when(userRepository.findById(userId)).thenReturn(Optional.of(testUser));
        when(mockFile.getOriginalFilename()).thenReturn("report.pdf");
        when(mockFile.getContentType()).thenReturn("application/pdf");
        when(mockFile.getSize()).thenReturn(3L);
        when(mockFile.getBytes()).thenReturn(fileContent);

        UUID attachmentId = UUID.randomUUID();
        LocalDateTime now = LocalDateTime.now();
        TaskAttachment savedAttachment = TaskAttachment.builder()
                .id(attachmentId)
                .task(testTask)
                .filename("report.pdf")
                .fileType("application/pdf")
                .fileSize(3L)
                .data(fileContent)
                .uploadedBy(testUser)
                .uploadedAt(now)
                .build();

        when(attachmentRepository.save(any(TaskAttachment.class))).thenReturn(savedAttachment);

        TaskAttachmentDTO result = attachmentService.uploadAttachment(taskId, userId, mockFile);

        assertNotNull(result);
        assertEquals(attachmentId, result.getId());
        assertEquals(taskId, result.getTaskId());
        assertEquals("report.pdf", result.getFilename());
        assertEquals("application/pdf", result.getFileType());
        assertEquals(3L, result.getFileSize());
        assertEquals(userId, result.getUploadedByUserId());
        assertEquals("testuser", result.getUploadedByUserName());
        assertEquals(now, result.getUploadedAt());

        verify(attachmentRepository).save(any(TaskAttachment.class));
        verify(auditLogService).logTaskAction(eq(testTask), eq(testUser), eq(AuditAction.ATTACHMENT_ADDED), anyString());
    }

    @Test
    @DisplayName("Should throw IllegalArgumentException when task is not found during upload")
    void testUploadAttachment_TaskNotFound() {
        when(taskRepository.findById(taskId)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class, () -> 
                attachmentService.uploadAttachment(taskId, userId, mockFile));

        verify(attachmentRepository, never()).save(any(TaskAttachment.class));
    }

    @Test
    @DisplayName("Should throw IllegalArgumentException when user is not found during upload")
    void testUploadAttachment_UserNotFound() {
        when(taskRepository.findById(taskId)).thenReturn(Optional.of(testTask));
        when(userRepository.findById(userId)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class, () -> 
                attachmentService.uploadAttachment(taskId, userId, mockFile));

        verify(attachmentRepository, never()).save(any(TaskAttachment.class));
    }

    @Test
    @DisplayName("Should throw IllegalArgumentException when file has an invalid extension")
    void testUploadAttachment_InvalidExtension() {
        when(taskRepository.findById(taskId)).thenReturn(Optional.of(testTask));
        when(userRepository.findById(userId)).thenReturn(Optional.of(testUser));
        when(mockFile.getOriginalFilename()).thenReturn("malicious.exe");

        assertThrows(IllegalArgumentException.class, () -> 
                attachmentService.uploadAttachment(taskId, userId, mockFile));

        verify(attachmentRepository, never()).save(any(TaskAttachment.class));
    }

    @Test
    @DisplayName("Should throw IllegalArgumentException when file has no extension")
    void testUploadAttachment_NoExtension() {
        when(taskRepository.findById(taskId)).thenReturn(Optional.of(testTask));
        when(userRepository.findById(userId)).thenReturn(Optional.of(testUser));
        when(mockFile.getOriginalFilename()).thenReturn("noextension");

        assertThrows(IllegalArgumentException.class, () -> 
                attachmentService.uploadAttachment(taskId, userId, mockFile));

        verify(attachmentRepository, never()).save(any(TaskAttachment.class));
    }

    @Test
    @DisplayName("Should clean filename to prevent path traversal issues")
    void testUploadAttachment_CleanFilename() throws IOException {
        byte[] fileContent = new byte[]{1, 2, 3};
        when(taskRepository.findById(taskId)).thenReturn(Optional.of(testTask));
        when(userRepository.findById(userId)).thenReturn(Optional.of(testUser));
        when(mockFile.getOriginalFilename()).thenReturn("../../unsafe/file.xlsx");
        when(mockFile.getContentType()).thenReturn("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        when(mockFile.getSize()).thenReturn(3L);
        when(mockFile.getBytes()).thenReturn(fileContent);

        TaskAttachment savedAttachment = TaskAttachment.builder()
                .id(UUID.randomUUID())
                .task(testTask)
                .filename("....unsafefile.xlsx")
                .fileType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
                .fileSize(3L)
                .data(fileContent)
                .uploadedBy(testUser)
                .build();

        when(attachmentRepository.save(any(TaskAttachment.class))).thenReturn(savedAttachment);

        TaskAttachmentDTO result = attachmentService.uploadAttachment(taskId, userId, mockFile);

        assertNotNull(result);
        assertEquals("....unsafefile.xlsx", result.getFilename());
        verify(attachmentRepository).save(any(TaskAttachment.class));
    }

    @Test
    @DisplayName("Should retrieve attachments by task ordered by upload date")
    void testGetAttachmentsByTask() {
        TaskAttachment a1 = TaskAttachment.builder()
                .id(UUID.randomUUID())
                .task(testTask)
                .filename("a1.docx")
                .uploadedBy(testUser)
                .build();

        when(attachmentRepository.findByTaskIdOrderByUploadedAtDesc(taskId))
                .thenReturn(Arrays.asList(a1));

        List<TaskAttachmentDTO> result = attachmentService.getAttachmentsByTask(taskId);

        assertEquals(1, result.size());
        assertEquals("a1.docx", result.get(0).getFilename());
        verify(attachmentRepository).findByTaskIdOrderByUploadedAtDesc(taskId);
    }

    @Test
    @DisplayName("Should return empty list when no attachments exist for a task")
    void testGetAttachmentsByTask_Empty() {
        when(attachmentRepository.findByTaskIdOrderByUploadedAtDesc(taskId))
                .thenReturn(Collections.emptyList());

        List<TaskAttachmentDTO> result = attachmentService.getAttachmentsByTask(taskId);

        assertTrue(result.isEmpty());
        verify(attachmentRepository).findByTaskIdOrderByUploadedAtDesc(taskId);
    }

    @Test
    @DisplayName("Should retrieve attachment data by ID successfully")
    void testGetAttachmentData_Success() {
        UUID attachmentId = UUID.randomUUID();
        TaskAttachment attachment = new TaskAttachment();
        attachment.setId(attachmentId);
        attachment.setFilename("doc.pdf");

        when(attachmentRepository.findById(attachmentId)).thenReturn(Optional.of(attachment));

        TaskAttachment result = attachmentService.getAttachmentData(attachmentId);

        assertNotNull(result);
        assertEquals(attachmentId, result.getId());
        assertEquals("doc.pdf", result.getFilename());
        verify(attachmentRepository).findById(attachmentId);
    }

    @Test
    @DisplayName("Should throw IllegalArgumentException when getting non-existent attachment data")
    void testGetAttachmentData_NotFound() {
        UUID attachmentId = UUID.randomUUID();
        when(attachmentRepository.findById(attachmentId)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class, () -> 
                attachmentService.getAttachmentData(attachmentId));
    }

    @Test
    @DisplayName("Should delete attachment successfully")
    void testDeleteAttachment_Success() {
        UUID attachmentId = UUID.randomUUID();
        TaskAttachment attachment = TaskAttachment.builder()
                .id(attachmentId)
                .task(testTask)
                .filename("doc.pdf")
                .uploadedBy(testUser)
                .build();

        when(attachmentRepository.findById(attachmentId)).thenReturn(Optional.of(attachment));
        when(userRepository.findById(userId)).thenReturn(Optional.of(testUser));
        doNothing().when(attachmentRepository).delete(attachment);

        attachmentService.deleteAttachment(attachmentId, userId);

        verify(attachmentRepository).delete(attachment);
        verify(auditLogService).logTaskAction(eq(testTask), eq(testUser), eq(AuditAction.ATTACHMENT_DELETED), anyString());
    }

    @Test
    @DisplayName("Should throw IllegalArgumentException when deleting non-existent attachment")
    void testDeleteAttachment_NotFound() {
        UUID attachmentId = UUID.randomUUID();
        when(attachmentRepository.findById(attachmentId)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class, () -> 
                attachmentService.deleteAttachment(attachmentId, userId));

        verify(attachmentRepository, never()).delete(any(TaskAttachment.class));
    }
}
