package com.thesis.smart_resource_planner.controller;

import com.thesis.smart_resource_planner.model.dto.TaskAttachmentDTO;
import com.thesis.smart_resource_planner.model.entity.TaskAttachment;
import com.thesis.smart_resource_planner.security.UserPrincipal;
import com.thesis.smart_resource_planner.service.TaskAttachmentService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("TaskAttachmentController Dedicated Tests")
class TaskAttachmentControllerDedicatedTest {

    @Mock
    private TaskAttachmentService attachmentService;

    private TaskAttachmentController controller;
    private UserPrincipal currentUser;
    private UUID taskId;
    private MultipartFile mockFile;

    @BeforeEach
    void setUp() {
        controller = new TaskAttachmentController(attachmentService);
        currentUser = new UserPrincipal(
                UUID.randomUUID(),
                "testuser",
                "test@example.com",
                "pw",
                List.of(new SimpleGrantedAuthority("ROLE_ADMIN")),
                true,
                UUID.randomUUID());
        taskId = UUID.randomUUID();
        mockFile = mock(MultipartFile.class);
    }

    @Test
    @DisplayName("uploadAttachment returns CREATED on successful upload")
    void uploadAttachment_success() throws IOException {
        TaskAttachmentDTO dto = TaskAttachmentDTO.builder()
                .id(UUID.randomUUID())
                .taskId(taskId)
                .filename("report.pdf")
                .build();

        when(mockFile.isEmpty()).thenReturn(false);
        when(attachmentService.uploadAttachment(taskId, currentUser.getId(), mockFile)).thenReturn(dto);

        ResponseEntity<TaskAttachmentDTO> response = controller.uploadAttachment(taskId, mockFile, currentUser);

        assertEquals(HttpStatus.CREATED, response.getStatusCode());
        assertEquals(dto.getId(), response.getBody().getId());
        verify(attachmentService).uploadAttachment(taskId, currentUser.getId(), mockFile);
    }

    @Test
    @DisplayName("uploadAttachment returns BAD_REQUEST when file is empty")
    void uploadAttachment_emptyFile() {
        when(mockFile.isEmpty()).thenReturn(true);

        ResponseEntity<TaskAttachmentDTO> response = controller.uploadAttachment(taskId, mockFile, currentUser);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertNull(response.getBody());
    }

    @Test
    @DisplayName("uploadAttachment returns BAD_REQUEST on IllegalArgumentException")
    void uploadAttachment_illegalArgument() throws IOException {
        when(mockFile.isEmpty()).thenReturn(false);
        when(attachmentService.uploadAttachment(taskId, currentUser.getId(), mockFile))
                .thenThrow(new IllegalArgumentException("Invalid file extension"));

        ResponseEntity<TaskAttachmentDTO> response = controller.uploadAttachment(taskId, mockFile, currentUser);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertEquals("Invalid file extension", response.getHeaders().getFirst("X-Error-Message"));
    }

    @Test
    @DisplayName("uploadAttachment returns INTERNAL_SERVER_ERROR on general Exception")
    void uploadAttachment_generalException() throws IOException {
        when(mockFile.isEmpty()).thenReturn(false);
        when(attachmentService.uploadAttachment(taskId, currentUser.getId(), mockFile))
                .thenThrow(new RuntimeException("IO failed"));

        ResponseEntity<TaskAttachmentDTO> response = controller.uploadAttachment(taskId, mockFile, currentUser);

        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, response.getStatusCode());
    }

    @Test
    @DisplayName("getAttachmentsByTask returns OK and list of attachments")
    void getAttachmentsByTask_success() {
        List<TaskAttachmentDTO> list = Arrays.asList(
                TaskAttachmentDTO.builder().id(UUID.randomUUID()).filename("a.xlsx").build()
        );
        when(attachmentService.getAttachmentsByTask(taskId)).thenReturn(list);

        ResponseEntity<List<TaskAttachmentDTO>> response = controller.getAttachmentsByTask(taskId);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(1, response.getBody().size());
        assertEquals("a.xlsx", response.getBody().get(0).getFilename());
    }

    @Test
    @DisplayName("getAttachmentsByTask returns INTERNAL_SERVER_ERROR on failure")
    void getAttachmentsByTask_failure() {
        when(attachmentService.getAttachmentsByTask(taskId)).thenThrow(new RuntimeException("DB error"));

        ResponseEntity<List<TaskAttachmentDTO>> response = controller.getAttachmentsByTask(taskId);

        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, response.getStatusCode());
    }

    @Test
    @DisplayName("downloadAttachment returns OK and resource body")
    void downloadAttachment_success() {
        UUID id = UUID.randomUUID();
        TaskAttachment attachment = new TaskAttachment();
        attachment.setFilename("report.pdf");
        attachment.setFileType("application/pdf");
        attachment.setFileSize(100L);
        attachment.setData(new byte[100]);

        when(attachmentService.getAttachmentData(id)).thenReturn(attachment);

        ResponseEntity<Resource> response = controller.downloadAttachment(id);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals(100L, response.getHeaders().getContentLength());
        assertTrue(response.getHeaders().getContentDisposition().toString().contains("report.pdf"));
    }

    @Test
    @DisplayName("downloadAttachment returns NOT_FOUND on IllegalArgumentException")
    void downloadAttachment_notFound() {
        UUID id = UUID.randomUUID();
        when(attachmentService.getAttachmentData(id)).thenThrow(new IllegalArgumentException("Attachment not found"));

        ResponseEntity<Resource> response = controller.downloadAttachment(id);

        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
    }

    @Test
    @DisplayName("downloadAttachment returns INTERNAL_SERVER_ERROR on general failure")
    void downloadAttachment_failure() {
        UUID id = UUID.randomUUID();
        when(attachmentService.getAttachmentData(id)).thenThrow(new RuntimeException("General failure"));

        ResponseEntity<Resource> response = controller.downloadAttachment(id);

        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, response.getStatusCode());
    }

    @Test
    @DisplayName("deleteAttachment returns NO_CONTENT on success")
    void deleteAttachment_success() {
        UUID id = UUID.randomUUID();
        doNothing().when(attachmentService).deleteAttachment(id, currentUser.getId());

        ResponseEntity<Void> response = controller.deleteAttachment(id, currentUser);

        assertEquals(HttpStatus.NO_CONTENT, response.getStatusCode());
        verify(attachmentService).deleteAttachment(id, currentUser.getId());
    }

    @Test
    @DisplayName("deleteAttachment returns NOT_FOUND on IllegalArgumentException")
    void deleteAttachment_notFound() {
        UUID id = UUID.randomUUID();
        doThrow(new IllegalArgumentException("Not found")).when(attachmentService).deleteAttachment(id, currentUser.getId());

        ResponseEntity<Void> response = controller.deleteAttachment(id, currentUser);

        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
    }

    @Test
    @DisplayName("deleteAttachment returns INTERNAL_SERVER_ERROR on general failure")
    void deleteAttachment_failure() {
        UUID id = UUID.randomUUID();
        doThrow(new RuntimeException("Failure")).when(attachmentService).deleteAttachment(id, currentUser.getId());

        ResponseEntity<Void> response = controller.deleteAttachment(id, currentUser);

        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, response.getStatusCode());
    }
}
