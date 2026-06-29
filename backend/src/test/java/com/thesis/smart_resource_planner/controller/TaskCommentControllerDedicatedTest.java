package com.thesis.smart_resource_planner.controller;

import com.thesis.smart_resource_planner.model.dto.TaskCommentCreateDTO;
import com.thesis.smart_resource_planner.model.dto.TaskCommentDTO;
import com.thesis.smart_resource_planner.repository.TaskRepository;
import com.thesis.smart_resource_planner.repository.UserRepository;
import com.thesis.smart_resource_planner.security.UserPrincipal;
import com.thesis.smart_resource_planner.service.TaskCommentService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("TaskCommentController Dedicated Tests")
class TaskCommentControllerDedicatedTest {

    @Mock
    private TaskCommentService commentService;
    @Mock
    private TaskRepository taskRepository;
    @Mock
    private UserRepository userRepository;

    private TaskCommentController controller;
    private UserPrincipal currentUser;

    @BeforeEach
    void setUp() {
        controller = new TaskCommentController(commentService, taskRepository, userRepository);
        currentUser = new UserPrincipal(
                UUID.randomUUID(),
                "employee",
                "employee@example.com",
                "pw",
                List.of(new SimpleGrantedAuthority("ROLE_EMPLOYEE")),
                true,
                UUID.randomUUID());
    }

    @Test
    @DisplayName("createComment returns CREATED on valid payload")
    void createComment_success() {
        UUID taskId = UUID.randomUUID();
        TaskCommentCreateDTO dto = TaskCommentCreateDTO.builder()
                .taskId(taskId)
                .comment("Looks good")
                .build();
        TaskCommentDTO created = TaskCommentDTO.builder().id(UUID.randomUUID()).taskId(taskId).build();

        when(taskRepository.existsById(taskId)).thenReturn(true);
        when(userRepository.existsById(currentUser.getId())).thenReturn(true);
        when(commentService.createComment(dto, currentUser.getId())).thenReturn(created);

        ResponseEntity<TaskCommentDTO> response = controller.createComment(dto, currentUser);
        assertEquals(HttpStatus.CREATED, response.getStatusCode());
        assertEquals(created.getId(), response.getBody().getId());
    }

    @Test
    @DisplayName("createComment returns NOT_FOUND when task is missing")
    void createComment_taskMissing() {
        UUID taskId = UUID.randomUUID();
        TaskCommentCreateDTO dto = TaskCommentCreateDTO.builder().taskId(taskId).comment("x").build();
        when(taskRepository.existsById(taskId)).thenReturn(false);

        ResponseEntity<TaskCommentDTO> response = controller.createComment(dto, currentUser);
        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
    }

    @Test
    @DisplayName("createComment returns BAD_REQUEST when comment is blank")
    void createComment_blankComment() {
        UUID taskId = UUID.randomUUID();
        TaskCommentCreateDTO dto = TaskCommentCreateDTO.builder().taskId(taskId).comment("   ").build();
        when(taskRepository.existsById(taskId)).thenReturn(true);
        when(userRepository.existsById(currentUser.getId())).thenReturn(true);

        ResponseEntity<TaskCommentDTO> response = controller.createComment(dto, currentUser);
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
    }

    @Test
    @DisplayName("getCommentsByTask returns list when task exists")
    void getCommentsByTask_success() {
        UUID taskId = UUID.randomUUID();
        List<TaskCommentDTO> comments = List.of(TaskCommentDTO.builder().id(UUID.randomUUID()).taskId(taskId).build());
        when(taskRepository.existsById(taskId)).thenReturn(true);
        when(commentService.getCommentsByTask(taskId)).thenReturn(comments);

        ResponseEntity<List<TaskCommentDTO>> response = controller.getCommentsByTask(taskId);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(1, response.getBody().size());
    }

    @Test
    @DisplayName("getCommentCount returns count when task exists")
    void getCommentCount_success() {
        UUID taskId = UUID.randomUUID();
        when(taskRepository.existsById(taskId)).thenReturn(true);
        when(commentService.getCommentCount(taskId)).thenReturn(7L);

        ResponseEntity<Long> response = controller.getCommentCount(taskId);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(7L, response.getBody());
    }

    @Test
    @DisplayName("deleteComment returns NO_CONTENT and handles exceptions")
    void deleteComment_successAndError() {
        UUID commentId = UUID.randomUUID();

        ResponseEntity<Void> ok = controller.deleteComment(commentId, currentUser);
        assertEquals(HttpStatus.NO_CONTENT, ok.getStatusCode());

        doThrow(new RuntimeException("delete failed")).when(commentService).deleteComment(commentId, currentUser.getId());
        ResponseEntity<Void> error = controller.deleteComment(commentId, currentUser);
        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, error.getStatusCode());
        assertNull(error.getBody());
    }
}

